"""
Screening workflow — delegates to LangGraph-based ScreeningWorkflowService.

Resume extraction remains standalone (single LLM call, no graph needed).
"""

import json
import logging

from langchain_core.messages import HumanMessage

from app.core.llm.langchain_llm import get_llm
from app.core.llm.prompts.screening_prompts import RESUME_EXTRACTION_PROMPT
from app.schemas.screening import (
    ScreeningRequest,
    ScreeningResponse,
    ResumeExtractionRequest,
    ExtractedProfile,
)
from app.services.screening_graph import get_screening_service

logger = logging.getLogger(__name__)


async def run_screening(request: ScreeningRequest) -> ScreeningResponse:
    """Run candidate screening through the LangGraph workflow."""
    service = get_screening_service()
    return await service.run(request)


async def extract_resume(request: ResumeExtractionRequest) -> ExtractedProfile:
    """Extract structured profile from resume text via LLM."""
    llm = get_llm()

    prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=request.resumeText[:5000])
    prompt += """

Return a JSON object with these fields:
{
  "firstName": "", "lastName": "", "email": "",
  "headline": "", "bio": "", "location": "",
  "skills": [{"name": "", "level": "Beginner | Intermediate | Advanced | Expert", "yearsOfExperience": 0}],
  "languages": [{"name": "", "proficiency": "Basic | Conversational | Fluent | Native"}],
  "experience": [{"company": "", "role": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM", "description": "", "technologies": [], "isCurrent": false}],
  "education": [{"institution": "", "degree": "", "fieldOfStudy": "", "startYear": 0, "endYear": 0}],
  "certifications": [{"name": "", "issuer": "", "issueDate": "YYYY-MM"}],
  "projects": [{"name": "", "description": "", "technologies": [], "role": "", "link": "", "startDate": "YYYY-MM", "endDate": "YYYY-MM"}],
  "availability": {"status": "Available", "type": "Full-time"},
  "socialLinks": {"linkedin": "", "github": "", "portfolio": ""},
  "phone": "", "totalExperienceYears": 0, "currentTitle": "", "currentCompany": ""
}

Return ONLY the JSON object."""

    response = await llm.ainvoke([HumanMessage(content=prompt)])

    text = response.content.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    result = json.loads(text.strip())
    return ExtractedProfile(**result)
