"""
backend/rag/embedder.py + indexer.py + retriever.py

The complete RAG pipeline in one module.

EMBEDDER:  text → vector (768 numbers representing meaning)
INDEXER:   store (text + vector) in pgvector
RETRIEVER: given a query, find the most similar stored chunks
"""

# ── embedder.py logic ─────────────────────────────────────────────────────────
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from backend.config.settings import get_settings

settings = get_settings()

def get_embedder() -> GoogleGenerativeAIEmbeddings:
    """
    Returns the Gemini embedding model.

    WHY A FUNCTION INSTEAD OF MODULE-LEVEL INSTANCE?
      Module-level: created when Python imports the module.
      If the module is imported during testing without API keys set,
      it crashes at import time — confusing error.
      A function: created on first call, after all settings are loaded.
    """
    return GoogleGenerativeAIEmbeddings(
        model=settings.gemini_embedding_model,  # "models/text-embedding-004"
        google_api_key=settings.google_api_key,
        task_type="retrieval_document",  # Optimized for storing documents
        # task_type options:
        #   "retrieval_document" → for indexing (what we store)
        #   "retrieval_query"    → for searching (what we query with)
        # Using different types for index vs query improves retrieval quality.
    )

def get_query_embedder() -> GoogleGenerativeAIEmbeddings:
    """Embedder optimized for query vectors (different task type)."""
    return GoogleGenerativeAIEmbeddings(
        model=settings.gemini_embedding_model,
        google_api_key=settings.google_api_key,
        task_type="retrieval_query",  # Optimized for querying
    )
