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
    HeaderMappingRequest,
    HeaderMappingResponse,
)
from app.services.screening_graph import get_screening_service

logger = logging.getLogger(__name__)


async def run_screening(request: ScreeningRequest, progress_cb=None) -> ScreeningResponse:
    service = get_screening_service()
    return await service.run(request, progress_cb=progress_cb)


async def extract_resume(request: ResumeExtractionRequest) -> ExtractedProfile:
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


CANONICAL_FIELDS = [
    "firstName", "lastName", "fullName", "email", "phone",
    "headline", "bio", "location",
    "skills", "languages",
    "totalExperienceYears", "currentTitle", "currentCompany",
    "education", "linkedin", "github", "portfolio",
]


async def map_headers(request: HeaderMappingRequest) -> HeaderMappingResponse:
    """Use the LLM to map arbitrary spreadsheet headers to our canonical fields.

    Why: users upload sheets with any column names ("Full Name", "Years Exp",
    "Candidate Email", "LinkedIn URL"). Hardcoded matching fails; one LLM call
    per upload returns a mapping the parser then applies to every row.
    """
    if not request.headers:
        return HeaderMappingResponse(mapping={})

    llm = get_llm()

    prompt = f"""You are mapping spreadsheet column headers to a canonical applicant schema.

Available canonical fields (target keys):
{", ".join(CANONICAL_FIELDS)}

Notes:
- "fullName" is used when a single column contains both first and last name; the parser will split it.
- "skills" should be a comma- or semicolon-separated list of skills.
- "totalExperienceYears" is a number of years of experience.
- For social links, use "linkedin", "github", "portfolio".
- If a header has no good canonical match, omit it from the mapping.

Spreadsheet headers:
{json.dumps(request.headers)}

Sample row (header -> value, for disambiguation):
{json.dumps(request.sampleRow, default=str)[:1500]}

Return ONLY a JSON object of the form:
{{"mapping": {{"<original_header>": "<canonical_field>", ...}}}}
"""

    response = await llm.ainvoke([HumanMessage(content=prompt)])
    text = response.content.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    try:
        parsed = json.loads(text.strip())
        mapping = parsed.get("mapping", {}) if isinstance(parsed, dict) else {}
    except Exception as e:
        logger.warning(f"Header mapping LLM returned invalid JSON: {e}")
        mapping = {}

    cleaned = {
        str(k): str(v)
        for k, v in mapping.items()
        if isinstance(v, str) and v in CANONICAL_FIELDS
    }
    return HeaderMappingResponse(mapping=cleaned)
