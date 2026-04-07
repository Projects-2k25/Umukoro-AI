from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "TalentLens AI Service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # LLM Provider: "gemini" or "claude"
    LLM_PROVIDER: str = "gemini"

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # gRPC Server
    GRPC_SERVER_PORT: int = 50051

    class Config:
        env_file = ".env"


settings = Settings()
