import logging
from typing import Optional

from app.config.settings import settings

logger = logging.getLogger(__name__)

_llm_instance = None


def get_llm():
    """Get or create the LangChain chat model based on LLM_PROVIDER setting."""
    global _llm_instance
    if _llm_instance is not None:
        return _llm_instance

    if settings.LLM_PROVIDER == "claude":
        from langchain_anthropic import ChatAnthropic

        logger.info(f"Initializing ChatAnthropic with model {settings.CLAUDE_MODEL}")
        _llm_instance = ChatAnthropic(
            model=settings.CLAUDE_MODEL,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.3,
            max_tokens=8192,
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI

        logger.info(f"Initializing ChatGoogleGenerativeAI with model {settings.GEMINI_MODEL}")
        _llm_instance = ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0.3,
            max_output_tokens=8192,
        )

    return _llm_instance
