from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Umukoro AI Service"
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

    # Screening tuning
    SCREENING_BATCH_SIZE: int = 20
    SCREENING_MAX_CONCURRENCY: int = 6

    # Progress callback to backend
    BACKEND_PROGRESS_URL: str = "http://localhost:3000/api/v1/screenings"
    INTERNAL_SERVICE_SECRET: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
