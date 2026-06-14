"""
backend/rag/indexer.py

Stores document chunks + their embeddings into pgvector.
Called during context collection — before any agents run.
"""

import asyncpg
from backend.rag.chunker import DocumentChunk
from backend.rag.embedder import get_embedder
from backend.config.settings import get_settings
import structlog

logger = structlog.get_logger()
settings = get_settings()


async def index_chunks(
    chunks: list[DocumentChunk],
    review_id: str,
    db_conn_string: str | None = None,
) -> int:
    """
    Embeds a list of chunks and stores them in pgvector.

    Args:
        chunks: List of DocumentChunk objects from the chunker
        review_id: Associates chunks with this review session
        db_conn_string: PostgreSQL connection string (defaults to settings)

    Returns:
        Number of chunks successfully indexed

    BATCH PROCESSING:
      We embed in batches of 100 to avoid hitting Gemini API rate limits.
      Sending 1000 individual embedding requests would hit rate limits.
      Batching reduces API calls from N to N/100.
    """
    if not chunks:
        return 0

    conn_string = db_conn_string or settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    embedder = get_embedder()
    batch_size = 100
    total_indexed = 0

    # Connect to PostgreSQL
    conn = await asyncpg.connect(conn_string)

    try:
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [chunk.content for chunk in batch]

            # Embed the entire batch in one API call
            logger.info(
                "Embedding batch",
                batch_num=i // batch_size + 1,
                batch_size=len(batch),
            )
            embeddings = await embedder.aembed_documents(texts)

            # Store each chunk + embedding in PostgreSQL
            for chunk, embedding in zip(batch, embeddings):
                await conn.execute(
                    """
                    INSERT INTO embeddings (review_id, source, content, metadata, embedding)
                    VALUES ($1, $2, $3, $4::jsonb, $5::vector)
                    """,
                    review_id,
                    chunk.source,
                    chunk.content,
                    str(chunk.metadata).replace("'", '"'),  # Convert to JSON string
                    str(embedding),  # pgvector accepts string representation
                )

            total_indexed += len(batch)

    finally:
        await conn.close()

    logger.info("Indexing complete", total_chunks=total_indexed, review_id=review_id)
    return total_indexed
