from app.config.settings import settings


async def call_llm_json(prompt: str, response_schema: dict = None) -> dict:
    if settings.LLM_PROVIDER == "claude":
        from app.core.llm.claude_client import call_claude_json
        return await call_claude_json(prompt, response_schema)
    else:
        from app.core.llm.gemini_client import call_gemini_json
        return await call_gemini_json(prompt, response_schema)


async def call_llm_text(prompt: str) -> str:
    if settings.LLM_PROVIDER == "claude":
        from app.core.llm.claude_client import call_claude_text
        return await call_claude_text(prompt)
    else:
        from app.core.llm.gemini_client import call_gemini_text
        return await call_gemini_text(prompt)


def get_model_name() -> str:
    if settings.LLM_PROVIDER == "claude":
        return settings.CLAUDE_MODEL
    return settings.GEMINI_MODEL
