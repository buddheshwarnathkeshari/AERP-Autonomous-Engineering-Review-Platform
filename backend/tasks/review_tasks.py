"""
backend/tasks/review_tasks.py

Celery task that runs the LangGraph review workflow in the background.

THE ASYNC BRIDGE PROBLEM:
  Celery tasks are synchronous by default.
  LangGraph nodes are async (they use `await`).
  You cannot `await` inside a sync Celery task.

SOLUTION: asyncio.run()
  asyncio.run() creates a new event loop, runs the async function to
  completion, and returns the result — bridging sync Celery with async LangGraph.

INTERVIEW: "How do you run async code in a synchronous context?"
  Use asyncio.run() to create a new event loop and run until complete.
  Alternative: asyncio.get_event_loop().run_until_complete() (deprecated in 3.10+)
  In production, prefer dedicated async workers (e.g., Celery with gevent or
  eventlet) for heavy async workloads.
"""

import asyncio
import asyncpg
from celery import shared_task
from backend.tasks.celery_app import celery_app
from backend.graph.state import create_initial_state
from backend.graph.workflow import workflow
from backend.config.settings import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()


@celery_app.task(
    bind=True,                  # `self` = the task instance (for retry/status)
    name="aerp.run_review",
    max_retries=3,              # Retry up to 3 times on failure
    default_retry_delay=30,     # Wait 30 seconds between retries
    soft_time_limit=600,        # Warn at 10 minutes
    time_limit=900,             # Hard kill at 15 minutes
)
def run_review_task(self, review_id: str, pr_url: str, jira_url: str = None, doc_url: str = None):
    """
    Celery task that runs the complete AERP review workflow.

    Called by FastAPI when a review is submitted.
    Runs asynchronously in a worker process.
    """
    logger.info("Review task started", review_id=review_id, task_id=self.request.id)

    # Update review status in DB
    asyncio.run(_update_review_status(review_id, "collecting"))

    try:
        # Create initial state
        initial_state = create_initial_state(
            review_id=review_id,
            pr_url=pr_url,
            jira_url=jira_url,
            doc_url=doc_url,
        )

        # Run the LangGraph workflow
        # thread_id enables checkpointing (state saved per thread)
        config = {"configurable": {"thread_id": review_id}}

        # asyncio.run bridges the sync Celery task and async LangGraph graph
        final_state = asyncio.run(
            workflow.ainvoke(initial_state, config=config)
        )

        # Check if workflow completed successfully
        if final_state.get("error"):
            asyncio.run(_update_review_status(review_id, "failed", error=final_state["error"]))
            return {"status": "failed", "error": final_state["error"]}

        # Update review status to complete
        asyncio.run(_update_review_status(review_id, "complete"))
        logger.info("Review task complete", review_id=review_id)

        return {
            "status": "complete",
            "review_id": review_id,
            "framework_detected": final_state.get("detected_framework"),
            "files_analyzed": len(final_state.get("changed_files_analysis") or {}),
        }

    except Exception as exc:
        logger.error("Review task failed", review_id=review_id, error=str(exc))
        asyncio.run(_update_review_status(review_id, "failed", error=str(exc)))

        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=30 * (self.request.retries + 1))


async def _update_review_status(review_id: str, status: str, error: str = None):
    """Updates the review status in PostgreSQL."""
    conn_string = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(conn_string)
    try:
        if error:
            await conn.execute(
                "UPDATE reviews SET status=$1, error=$2, updated_at=NOW() WHERE id=$3",
                status, error, review_id,
            )
        else:
            await conn.execute(
                "UPDATE reviews SET status=$1, updated_at=NOW() WHERE id=$2",
                status, review_id,
            )
    finally:
        await conn.close()
