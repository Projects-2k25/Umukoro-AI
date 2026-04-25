import logging
from fastapi import APIRouter, HTTPException
from app.schemas.screening import (
    ScreeningRequest,
    ScreeningResponse,
    ResumeExtractionRequest,
    ExtractedProfile,
    HeaderMappingRequest,
    HeaderMappingResponse,
)
from app.services.screening_graph import LLMUnavailableError, _friendly_llm_error
from app.services.screening_workflow import run_screening, extract_resume, map_headers

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
    except LLMUnavailableError as e:
        logger.error(f"LLM unavailable: {e}")
        raise HTTPException(status_code=502, detail=str(e))
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
            status_code=502, detail=_friendly_llm_error(e)
        )


@router.post("/map-headers", response_model=HeaderMappingResponse)
async def map_spreadsheet_headers(request: HeaderMappingRequest):
    try:
        return await map_headers(request)
    except Exception as e:
        logger.error(f"Header mapping failed: {e}")
        raise HTTPException(
            status_code=502, detail=_friendly_llm_error(e)
        )
