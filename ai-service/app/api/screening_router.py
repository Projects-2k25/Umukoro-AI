import logging
from fastapi import APIRouter, HTTPException
from app.schemas.screening import (
    ScreeningRequest,
    ScreeningResponse,
    ResumeExtractionRequest,
    ExtractedProfile,
)
from app.services.screening_workflow import run_screening, extract_resume

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/screen", response_model=ScreeningResponse)
async def screen_candidates(request: ScreeningRequest):
    try:
        logger.info(
            f"Screening {len(request.candidates)} candidates for '{request.job.title}'"
        )
        result = await run_screening(request)
        logger.info(
            f"Screening complete: {len(result.results)} shortlisted in {result.metadata.processingTimeMs}ms"
        )
        return result
    except Exception as e:
        logger.error(f"Screening failed: {e}")
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")


@router.post("/extract-resume", response_model=ExtractedProfile)
async def extract_resume_profile(request: ResumeExtractionRequest):
    try:
        return await extract_resume(request)
    except Exception as e:
        logger.error(f"Resume extraction failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Resume extraction failed: {str(e)}"
        )
