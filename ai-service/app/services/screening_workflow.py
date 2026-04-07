import time
import json
import logging
from typing import TypedDict, Optional

from app.core.llm.gemini_client import call_gemini_json, call_gemini_text
from app.core.llm.prompts.screening_prompts import (
    BATCH_EVALUATION_PROMPT,
    REASONING_SUMMARY_PROMPT,
    RESUME_EXTRACTION_PROMPT,
)
from app.schemas.screening import (
    ScreeningRequest,
    ScreeningResponse,
    RankedCandidate,
    ScreeningMetadata,
    CandidateEvaluation,
    DimensionAnalysis,
    ResumeExtractionRequest,
    ExtractedProfile,
)
from app.config.settings import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 10


def _format_skills(job) -> str:
    if not job.requiredSkills:
        return "No specific skills listed"
    lines = []
    for s in job.requiredSkills:
        req = " (REQUIRED)" if s.required else ""
        lines.append(f"- {s.name} (importance: {s.weight}/5){req}")
    return "\n".join(lines)


def _format_education(job) -> str:
    if not job.educationRequirements:
        return "No specific education requirements"
    lines = []
    for e in job.educationRequirements:
        req = " (REQUIRED)" if e.required else ""
        field = f" in {e.field}" if e.field else ""
        lines.append(f"- {e.level}{field}{req}")
    return "\n".join(lines)


def _format_candidate(candidate, idx: int) -> str:
    skills_str = ", ".join(
        [f"{s.name} ({s.yearsOfExperience}yr)" for s in candidate.skills[:15]]
    ) or "None listed"

    edu_str = ", ".join(
        [f"{e.degree} in {e.field} from {e.institution}" for e in candidate.education[:3]]
    ) or "None listed"

    work_str = ""
    for w in candidate.workHistory[:3]:
        work_str += f"\n    - {w.title} at {w.company}"

    resume_excerpt = ""
    if candidate.resumeText:
        resume_excerpt = f"\n  Resume excerpt: {candidate.resumeText[:500]}"

    return f"""### Candidate #{idx}: {candidate.firstName} {candidate.lastName} (ID: {candidate.id})
  - Current Role: {candidate.currentTitle or 'N/A'} at {candidate.currentCompany or 'N/A'}
  - Total Experience: {candidate.totalExperienceYears} years
  - Skills: {skills_str}
  - Education: {edu_str}
  - Work History:{work_str or ' None listed'}
  - Certifications: {', '.join(candidate.certifications[:5]) or 'None'}{resume_excerpt}"""


async def evaluate_batch(job, candidates, config) -> list[dict]:
    formatted_candidates = "\n\n".join(
        [_format_candidate(c, i + 1) for i, c in enumerate(candidates)]
    )

    custom_inst = ""
    if config.customInstructions:
        custom_inst = f"\n### Additional Instructions from Recruiter:\n{config.customInstructions}\n"

    prompt = BATCH_EVALUATION_PROMPT.format(
        job_title=job.title,
        job_description=job.description[:2000],
        formatted_skills=_format_skills(job),
        experience_level=job.experienceLevel,
        min_years=job.minExperienceYears,
        max_years=job.maxExperienceYears,
        formatted_education=_format_education(job),
        custom_instructions=custom_inst,
        formatted_candidates=formatted_candidates,
    )

    prompt += """

Return a JSON array of evaluations. Each element must have:
{
  "candidateId": "the candidate's ID string",
  "skillsScore": integer 0-100,
  "experienceScore": integer 0-100,
  "educationScore": integer 0-100,
  "relevanceScore": integer 0-100,
  "strengths": ["strength 1", "strength 2"],
  "gaps": ["gap 1"],
  "risks": ["risk 1"] or [],
  "dimensionAnalysis": [
    {"dimension": "Technical Skills", "score": 85, "rationale": "brief explanation"},
    {"dimension": "Experience Level", "score": 70, "rationale": "brief explanation"},
    {"dimension": "Education", "score": 90, "rationale": "brief explanation"},
    {"dimension": "Role Relevance", "score": 80, "rationale": "brief explanation"}
  ]
}

Return ONLY the JSON array, no other text."""

    result = await call_gemini_json(prompt)
    if isinstance(result, dict) and "evaluations" in result:
        result = result["evaluations"]
    if not isinstance(result, list):
        result = [result]
    return result


def compute_scores(evaluations: list[dict], weights) -> list[dict]:
    for ev in evaluations:
        overall = (
            ev.get("skillsScore", 0) * weights.skills
            + ev.get("experienceScore", 0) * weights.experience
            + ev.get("educationScore", 0) * weights.education
            + ev.get("relevanceScore", 0) * weights.relevance
        )
        ev["overallScore"] = round(overall)
    return evaluations


def rank_and_shortlist(evaluations: list[dict], shortlist_size: int) -> list[dict]:
    sorted_evals = sorted(evaluations, key=lambda x: x.get("overallScore", 0), reverse=True)
    shortlisted = sorted_evals[:shortlist_size]

    for i, ev in enumerate(shortlisted):
        ev["rank"] = i + 1
        score = ev.get("overallScore", 0)
        if score >= 85:
            ev["recommendation"] = "STRONG_YES"
        elif score >= 70:
            ev["recommendation"] = "YES"
        elif score >= 55:
            ev["recommendation"] = "MAYBE"
        else:
            ev["recommendation"] = "NO"

    return shortlisted


async def generate_reasoning(job, shortlisted: list[dict], candidates_map: dict) -> list[dict]:
    candidates_text = ""
    for ev in shortlisted:
        cid = ev.get("candidateId", "")
        candidate = candidates_map.get(cid)
        name = f"{candidate.firstName} {candidate.lastName}" if candidate else cid
        candidates_text += f"""
Candidate: {name} (Rank #{ev['rank']})
- Overall Score: {ev['overallScore']}/100
- Skills: {ev.get('skillsScore', 0)}, Experience: {ev.get('experienceScore', 0)}, Education: {ev.get('educationScore', 0)}, Relevance: {ev.get('relevanceScore', 0)}
- Strengths: {', '.join(ev.get('strengths', []))}
- Gaps: {', '.join(ev.get('gaps', []))}
"""

    prompt = REASONING_SUMMARY_PROMPT.format(
        job_title=job.title,
        formatted_candidates_with_scores=candidates_text,
    )

    prompt += """

Return a JSON array where each element has:
{"candidateId": "id", "reasoningSummary": "2-3 sentence explanation"}

Return ONLY the JSON array."""

    result = await call_gemini_json(prompt)
    if isinstance(result, dict) and "summaries" in result:
        result = result["summaries"]
    if not isinstance(result, list):
        result = [result]

    reasoning_map = {r.get("candidateId", ""): r.get("reasoningSummary", "") for r in result}

    for ev in shortlisted:
        cid = ev.get("candidateId", "")
        ev["reasoningSummary"] = reasoning_map.get(cid, "Evaluation based on skills, experience, and role relevance match.")

    return shortlisted


async def run_screening(request: ScreeningRequest) -> ScreeningResponse:
    start_time = time.time()
    job = request.job
    candidates = request.candidates
    config = request.config

    candidates_map = {c.id: c for c in candidates}

    # Batch evaluate
    all_evaluations = []
    for i in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[i : i + BATCH_SIZE]
        logger.info(f"Evaluating batch {i // BATCH_SIZE + 1} ({len(batch)} candidates)")
        batch_results = await evaluate_batch(job, batch, config)
        all_evaluations.extend(batch_results)

    # Compute weighted scores
    all_evaluations = compute_scores(all_evaluations, config.weights)

    # Rank and shortlist
    shortlisted = rank_and_shortlist(all_evaluations, config.shortlistSize)

    # Generate reasoning for shortlisted
    shortlisted = await generate_reasoning(job, shortlisted, candidates_map)

    processing_time_ms = int((time.time() - start_time) * 1000)

    results = [
        RankedCandidate(
            candidateId=ev.get("candidateId", ""),
            rank=ev.get("rank", 0),
            overallScore=ev.get("overallScore", 0),
            skillsScore=ev.get("skillsScore", 0),
            experienceScore=ev.get("experienceScore", 0),
            educationScore=ev.get("educationScore", 0),
            relevanceScore=ev.get("relevanceScore", 0),
            strengths=ev.get("strengths", []),
            gaps=ev.get("gaps", []),
            risks=ev.get("risks", []),
            recommendation=ev.get("recommendation", "MAYBE"),
            reasoningSummary=ev.get("reasoningSummary", ""),
            dimensionAnalysis=[
                DimensionAnalysis(**d) for d in ev.get("dimensionAnalysis", [])
            ],
        )
        for ev in shortlisted
    ]

    return ScreeningResponse(
        results=results,
        metadata=ScreeningMetadata(
            totalEvaluated=len(candidates),
            processingTimeMs=processing_time_ms,
            model=settings.GEMINI_MODEL,
        ),
    )


async def extract_resume(request: ResumeExtractionRequest) -> ExtractedProfile:
    prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=request.resumeText[:5000])

    prompt += """

Return a JSON object with these fields:
{"firstName": "", "lastName": "", "email": "", "phone": "", "skills": [{"name": "", "yearsOfExperience": 0}], "totalExperienceYears": 0, "currentTitle": "", "currentCompany": "", "workHistory": [{"title": "", "company": "", "startDate": "", "endDate": "", "description": ""}], "education": [{"degree": "", "field": "", "institution": "", "graduationYear": 0}], "certifications": []}

Return ONLY the JSON object."""

    result = await call_gemini_json(prompt)
    return ExtractedProfile(**result)
