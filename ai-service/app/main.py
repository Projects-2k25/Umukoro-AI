import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.api.screening_router import router as screening_router

logger = logging.getLogger(__name__)

_grpc_server = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start gRPC server alongside FastAPI."""
    global _grpc_server

    # Start gRPC server
    try:
        from app.grpc.server import start_grpc_server

        _grpc_server = await start_grpc_server(port=settings.GRPC_SERVER_PORT)
        logger.info(f"gRPC server started on port {settings.GRPC_SERVER_PORT}")
    except Exception as e:
        logger.error(f"gRPC server start failed: {e}")

    logger.info(f"{settings.APP_NAME} started successfully")

    yield

    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}")

    if _grpc_server:
        try:
            from app.grpc.server import stop_grpc_server

            await stop_grpc_server()
            logger.info("gRPC server stopped")
        except Exception as e:
            logger.warning(f"gRPC server stop error: {e}")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-Powered Talent Screening Service using Gemini",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(screening_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
