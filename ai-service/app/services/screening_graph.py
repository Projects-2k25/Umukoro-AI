import asyncio
import json
import logging
import time
from typing import Optional

from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage

from app.core.llm.langchain_llm import get_llm
from app.core.llm.prompts.screening_prompts import (
    BATCH_EVALUATION_PROMPT,
    REASONING_SUMMARY_PROMPT,
)
from app.schemas.screening import (
    ScreeningRequest,
    ScreeningResponse,
    RankedCandidate,
    ScreeningMetadata,
    DimensionAnalysis,
)
from app.services.screening_state import ScreeningGraphState
from app.config.settings import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = int(getattr(settings, "SCREENING_BATCH_SIZE", 20) or 20)
MAX_CONCURRENT_BATCHES = int(getattr(settings, "SCREENING_MAX_CONCURRENCY", 6) or 6)
PER_BATCH_RETRIES = 2


class LLMUnavailableError(Exception):
    """Raised when the configured LLM provider rejects the request (auth, quota, billing)."""


def _friendly_llm_error(exc: Exception) -> str:
    msg = str(exc).lower()
    if "credit balance" in msg or "billing" in msg:
        return (
            "The configured LLM provider has insufficient credits. "
            "Add credits to your Anthropic or Gemini account, or switch LLM_PROVIDER in the AI service .env."
        )
    if "quota" in msg or "rate" in msg or "resource_exhausted" in msg or "429" in msg:
        return (
            "The LLM provider rate limit / free-tier quota was exceeded. "
            "Wait a moment and retry, or switch to a paid plan / different provider."
        )
    if "api key" in msg or "unauthorized" in msg or "401" in msg or "invalid_api_key" in msg:
        return "The LLM API key is invalid or missing. Check ANTHROPIC_API_KEY or GEMINI_API_KEY in the AI service .env."
    return f"LLM provider error: {exc}"


class ScreeningWorkflowService:
    def __init__(self):
        self.llm = get_llm()
        self.workflow = self._build_workflow()
        logger.info("ScreeningWorkflowService initialized with LangGraph")

    def _build_workflow(self) -> StateGraph:
        workflow = StateGraph(ScreeningGraphState)

        workflow.add_node("evaluate_all", self._evaluate_all)
        workflow.add_node("compute_scores", self._compute_scores)
        workflow.add_node("rank_shortlist", self._rank_shortlist)
        workflow.add_node("generate_reasoning", self._generate_reasoning)
        workflow.add_node("build_response", self._build_response)

        workflow.set_entry_point("evaluate_all")
        workflow.add_edge("evaluate_all", "compute_scores")
        workflow.add_edge("compute_scores", "rank_shortlist")

        workflow.add_conditional_edges(
            "rank_shortlist",
            self._route_after_ranking,
            {
                "generate_reasoning": "generate_reasoning",
                "build_response": "build_response",
            },
        )

        workflow.add_edge("generate_reasoning", "build_response")
        workflow.add_edge("build_response", END)

        return workflow.compile()

    def _route_after_ranking(self, state: ScreeningGraphState) -> str:
        if state.get("skip_reasoning", False):
            return "build_response"
        return "generate_reasoning"

    async def _evaluate_one_batch(
        self,
        batch_idx: int,
        batch: list,
        job,
        config,
        semaphore: asyncio.Semaphore,
        progress_cb,
        total_batches: int,
    ) -> list[dict]:
        async with semaphore:
            prompt_text = self._build_evaluation_prompt(job, batch, config)
            last_err: Optional[Exception] = None
            for attempt in range(PER_BATCH_RETRIES + 1):
                try:
                    response = await self.llm.ainvoke([
                        SystemMessage(content="You are an expert talent acquisition specialist."),
                        HumanMessage(content=prompt_text),
                    ])
                    parsed = json.loads(self._clean_json(response.content))
                    if isinstance(parsed, dict) and "evaluations" in parsed:
                        parsed = parsed["evaluations"]
                    if not isinstance(parsed, list):
                        parsed = [parsed]

                    if progress_cb:
                        try:
                            await progress_cb(batch_idx, total_batches, len(batch))
                        except Exception:
                            logger.debug("progress_cb raised; ignoring", exc_info=True)

                    logger.info(
                        f"Batch {batch_idx + 1}/{total_batches} evaluated ({len(batch)} candidates)"
                    )
                    return parsed
                except Exception as e:
                    last_err = e
                    msg = str(e).lower()
                    transient = any(s in msg for s in ("timeout", "rate", "quota", "resource_exhausted", "429", "503", "unavailable"))
                    if attempt < PER_BATCH_RETRIES and transient:
                        backoff = 2 ** attempt
                        logger.warning(
                            f"Batch {batch_idx + 1} attempt {attempt + 1} failed ({e}); retrying in {backoff}s"
                        )
                        await asyncio.sleep(backoff)
                        continue
                    break
            raise LLMUnavailableError(_friendly_llm_error(last_err)) from last_err

    async def _evaluate_all(self, state: ScreeningGraphState) -> dict:
        candidates = state["candidates"]
        if not candidates:
            return {"evaluations": []}

        batches = [
            candidates[i : i + BATCH_SIZE]
            for i in range(0, len(candidates), BATCH_SIZE)
        ]
        total_batches = len(batches)
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)
        progress_cb = state.get("progress_cb")

        logger.info(
            f"Evaluating {len(candidates)} candidates in {total_batches} batches "
            f"(batch_size={BATCH_SIZE}, max_concurrency={MAX_CONCURRENT_BATCHES})"
        )

        tasks = [
            self._evaluate_one_batch(
                idx, batch, state["job"], state["config"],
                semaphore, progress_cb, total_batches,
            )
            for idx, batch in enumerate(batches)
        ]

        results_per_batch = await asyncio.gather(*tasks, return_exceptions=False)
        evaluations = [ev for batch_evals in results_per_batch for ev in batch_evals]

        return {"evaluations": evaluations, "all_batches_done": True}

    async def _compute_scores(self, state: ScreeningGraphState) -> dict:
        weights = state["config"].weights
        evaluations = list(state["evaluations"])

        for ev in evaluations:
            overall = (
                ev.get("skillsScore", 0) * weights.skills
                + ev.get("experienceScore", 0) * weights.experience
                + ev.get("educationScore", 0) * weights.education
                + ev.get("relevanceScore", 0) * weights.relevance
            )
            ev["overallScore"] = round(overall)

        return {"evaluations": evaluations}

    async def _rank_shortlist(self, state: ScreeningGraphState) -> dict:
        evaluations = state["evaluations"]
        shortlist_size = state["config"].shortlistSize

        sorted_evals = sorted(
            evaluations, key=lambda x: x.get("overallScore", 0), reverse=True
        )
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

        skip = all(ev.get("overallScore", 0) < 40 for ev in shortlisted)

        return {"shortlisted": shortlisted, "skip_reasoning": skip}

    async def _generate_reasoning(self, state: ScreeningGraphState) -> dict:
        job = state["job"]
        shortlisted = list(state["shortlisted"])
        candidates_map = state["candidates_map"]

        prompt_text = self._build_reasoning_prompt(job, shortlisted, candidates_map)

        try:
            response = await self.llm.ainvoke([
                SystemMessage(content="You are a recruiter-facing summary writer."),
                HumanMessage(content=prompt_text),
            ])
        except Exception as e:
            raise LLMUnavailableError(_friendly_llm_error(e)) from e

        result = json.loads(self._clean_json(response.content))
        if isinstance(result, dict) and "summaries" in result:
            result = result["summaries"]
        if not isinstance(result, list):
            result = [result]

        reasoning_map = {
            r.get("candidateId", ""): r.get("reasoningSummary", "") for r in result
        }

        for ev in shortlisted:
            cid = ev.get("candidateId", "")
            ev["reasoningSummary"] = reasoning_map.get(
                cid,
                "Evaluation based on skills, experience, and role relevance match.",
            )

        return {"shortlisted": shortlisted}

    async def _build_response(self, state: ScreeningGraphState) -> dict:
        shortlisted = state.get("shortlisted", [])

        if state.get("skip_reasoning", False):
            for ev in shortlisted:
                ev.setdefault(
                    "reasoningSummary",
                    "All candidates scored below threshold. No detailed reasoning generated.",
                )

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

        return {"results": results}

    def _format_skills(self, job) -> str:
        if not job.requiredSkills:
            return "No specific skills listed"
        lines = []
        for s in job.requiredSkills:
            req = " (REQUIRED)" if s.required else ""
            lines.append(f"- {s.name} (importance: {s.weight}/5){req}")
        return "\n".join(lines)

    def _format_education(self, job) -> str:
        if not job.educationRequirements:
            return "No specific education requirements"
        lines = []
        for e in job.educationRequirements:
            req = " (REQUIRED)" if e.required else ""
            field = f" in {e.field}" if e.field else ""
            lines.append(f"- {e.level}{field}{req}")
        return "\n".join(lines)

    def _format_candidate(self, candidate, idx: int) -> str:
        skills_str = (
            ", ".join(
                [
                    f"{s.name}({s.yearsOfExperience}y)"
                    for s in candidate.skills[:12]
                ]
            )
            or "None"
        )

        edu_str = (
            "; ".join(
                [
                    f"{e.degree} {e.fieldOfStudy}".strip()
                    for e in candidate.education[:2]
                    if e.degree or e.fieldOfStudy
                ]
            )
            or "None"
        )

        exp_str = ""
        for w in candidate.experience[:3]:
            current = "*" if w.isCurrent else ""
            exp_str += f" | {w.role}@{w.company}{current}"

        projects_str = ""
        for p in candidate.projects[:2]:
            techs = f"[{','.join(p.technologies[:4])}]" if p.technologies else ""
            projects_str += f" | {p.name}{techs}"

        has_structured = bool(
            candidate.skills or candidate.experience or candidate.education
        )
        resume_excerpt = ""
        if candidate.resumeText and not has_structured:
            resume_excerpt = f"\n  Resume: {candidate.resumeText[:400]}"

        return (
            f"#{idx} {candidate.firstName} {candidate.lastName} (ID:{candidate.id})\n"
            f"  Title: {candidate.currentTitle or 'N/A'} | "
            f"Exp: {candidate.totalExperienceYears}y | "
            f"Loc: {candidate.location or 'N/A'}\n"
            f"  Skills: {skills_str}\n"
            f"  Edu: {edu_str}\n"
            f"  Work:{exp_str or ' None'}\n"
            f"  Projects:{projects_str or ' None'}"
            f"{resume_excerpt}"
        )

    def _build_evaluation_prompt(self, job, batch, config) -> str:
        formatted_candidates = "\n\n".join(
            [self._format_candidate(c, i + 1) for i, c in enumerate(batch)]
        )

        custom_inst = ""
        if config.customInstructions:
            custom_inst = f"\n### Additional Instructions from Recruiter:\n{config.customInstructions}\n"

        prompt = BATCH_EVALUATION_PROMPT.format(
            job_title=job.title,
            job_description=job.description[:1500],
            formatted_skills=self._format_skills(job),
            experience_level=job.experienceLevel,
            min_years=job.minExperienceYears,
            max_years=job.maxExperienceYears,
            formatted_education=self._format_education(job),
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

        return prompt

    def _build_reasoning_prompt(self, job, shortlisted, candidates_map) -> str:
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

        return prompt

    @staticmethod
    def _clean_json(text: str) -> str:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()

    async def run(self, request: ScreeningRequest, progress_cb=None) -> ScreeningResponse:
        start_time = time.time()
        candidates_map = {c.id: c for c in request.candidates}

        initial_state: ScreeningGraphState = {
            "job": request.job,
            "candidates": request.candidates,
            "config": request.config,
            "candidates_map": candidates_map,
            "evaluations": [],
            "shortlisted": [],
            "current_batch_index": 0,
            "all_batches_done": False,
            "skip_reasoning": False,
            "results": [],
            "error": None,
            "progress_cb": progress_cb,
        }

        try:
            final_state = await self.workflow.ainvoke(initial_state)
        except Exception as e:
            logger.error(f"Screening workflow error: {e}", exc_info=True)
            raise

        processing_time_ms = int((time.time() - start_time) * 1000)

        return ScreeningResponse(
            results=final_state["results"],
            metadata=ScreeningMetadata(
                totalEvaluated=len(request.candidates),
                processingTimeMs=processing_time_ms,
                model=settings.GEMINI_MODEL
                if settings.LLM_PROVIDER != "claude"
                else settings.CLAUDE_MODEL,
            ),
        )


_service: Optional[ScreeningWorkflowService] = None


def get_screening_service() -> ScreeningWorkflowService:
    global _service
    if _service is None:
        _service = ScreeningWorkflowService()
    return _service
