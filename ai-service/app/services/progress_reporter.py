import logging
from typing import Optional

import httpx

from app.config.settings import settings

logger = logging.getLogger(__name__)


def make_progress_callback(screening_id: Optional[str]):
    """Build an awaitable progress_cb(batch_idx, total_batches, batch_size).

    Posts to the backend's internal progress endpoint. No-op when screening_id
    is missing or no INTERNAL_SERVICE_SECRET is configured. Failures are
    swallowed — progress reporting is best-effort.
    """
    if not screening_id or not settings.INTERNAL_SERVICE_SECRET:
        return None

    base_url = settings.BACKEND_PROGRESS_URL.rstrip("/")
    url = f"{base_url}/{screening_id}/progress"
    headers = {"x-internal-secret": settings.INTERNAL_SERVICE_SECRET}

    state = {"done": 0, "candidates_done": 0}

    async def _cb(batch_idx: int, total_batches: int, batch_size: int):
        state["done"] += 1
        state["candidates_done"] += batch_size
        payload = {
            "batchesDone": state["done"],
            "batchesTotal": total_batches,
            "candidatesDone": state["candidates_done"],
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code >= 400:
                    logger.warning(
                        f"Progress POST {url} -> {resp.status_code}: {resp.text[:200]}"
                    )
        except Exception as e:
            logger.warning(f"Progress callback failed for {screening_id}: {e}")

    return _cb
