from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "TalentLens AI Service"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # gRPC Server
    GRPC_SERVER_PORT: int = 50051

    class Config:
        env_file = ".env"


settings = Settings()
