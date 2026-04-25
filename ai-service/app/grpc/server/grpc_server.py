"""
gRPC Server for Umukoro AI Screening Service.
Runs alongside the FastAPI HTTP server.
"""

import logging
from concurrent import futures
from grpc import aio

from app.grpc.generated import screening_service_pb2_grpc
from app.grpc.server.screening_grpc_service import ScreeningServicer

logger = logging.getLogger(__name__)

_grpc_server = None


async def start_grpc_server(port: int = 50051) -> aio.Server:
    """Start the gRPC server on the specified port."""
    global _grpc_server

    logger.info(f"Starting gRPC server on port {port}")

    server = aio.server(
        futures.ThreadPoolExecutor(max_workers=10),
        options=[
            ("grpc.max_receive_message_length", 10 * 1024 * 1024),  # 10MB
            ("grpc.max_send_message_length", 10 * 1024 * 1024),
            ("grpc.keepalive_time_ms", 30000),
            ("grpc.keepalive_timeout_ms", 5000),
            ("grpc.keepalive_permit_without_calls", True),
            ("grpc.http2.min_ping_interval_without_data_ms", 10000),
        ],
    )

    servicer = ScreeningServicer()
    screening_service_pb2_grpc.add_ScreeningServiceServicer_to_server(servicer, server)

    listen_addr = f"0.0.0.0:{port}"
    server.add_insecure_port(listen_addr)

    await server.start()

    _grpc_server = server
    logger.info(f"gRPC Screening Service started on {listen_addr}")

    return server


async def stop_grpc_server(grace_period: float = 5.0) -> None:
    """Gracefully stop the gRPC server."""
    global _grpc_server

    if _grpc_server:
        logger.info("Stopping gRPC server...")
        await _grpc_server.stop(grace_period)
        _grpc_server = None
        logger.info("gRPC server stopped")
