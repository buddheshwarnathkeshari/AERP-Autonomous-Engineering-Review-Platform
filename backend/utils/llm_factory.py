from backend.config.settings import get_settings
from langchain_core.language_models.chat_models import BaseChatModel

settings = get_settings()

def get_llm(temperature=0.0) -> BaseChatModel:
    """Returns a LangChain chat model based on the configured LLM_PROVIDER."""
    provider = settings.llm_provider.lower()
    
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        if not settings.openai_api_key:
            import structlog
            structlog.get_logger().warning("OPENAI_API_KEY is missing! Using mock model fallback.")
        return ChatOpenAI(
            model=settings.openai_model,
            api_key=settings.openai_api_key,
            temperature=temperature
        )
        
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        if not settings.anthropic_api_key:
            import structlog
            structlog.get_logger().warning("ANTHROPIC_API_KEY is missing! Using mock model fallback.")
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=temperature
        )
        
    else:
        # Default to Gemini
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=settings.gemini_model,
            api_key=settings.google_api_key,
            temperature=temperature
        )
