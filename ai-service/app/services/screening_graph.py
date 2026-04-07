"""
LangGraph-based screening workflow service.

Orchestrates candidate evaluation through a StateGraph:
  batch_evaluate → compute_scores → rank_shortlist → generate_reasoning → build_response
"""

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

BATCH_SIZE = 10


class ScreeningWorkflowService:
    """Screening workflow orchestrated by LangGraph StateGraph."""

    def __init__(self):
        self.llm = get_llm()
        self.workflow = self._build_workflow()
        logger.info("ScreeningWorkflowService initialized with LangGraph")

    # ------------------------------------------------------------------ #
    #  Graph construction                                                  #
    # ------------------------------------------------------------------ #

    def _build_workflow(self) -> StateGraph:
        workflow = StateGraph(ScreeningGraphState)

        # Nodes
        workflow.add_node("batch_evaluate", self._batch_evaluate)
        workflow.add_node("compute_scores", self._compute_scores)
        workflow.add_node("rank_shortlist", self._rank_shortlist)
        workflow.add_node("generate_reasoning", self._generate_reasoning)
        workflow.add_node("build_response", self._build_response)

        # Entry
        workflow.set_entry_point("batch_evaluate")

        # batch_evaluate loops until all batches processed
        workflow.add_conditional_edges(
            "batch_evaluate",
            self._route_after_batch,
            {
                "batch_evaluate": "batch_evaluate",
                "compute_scores": "compute_scores",
            },
        )

        workflow.add_edge("compute_scores", "rank_shortlist")

        # Skip reasoning if no viable candidates
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

    # ------------------------------------------------------------------ #
    #  Routing functions                                                   #
    # ------------------------------------------------------------------ #

    def _route_after_batch(self, state: ScreeningGraphState) -> str:
        if state.get("all_batches_done", False):
            return "compute_scores"
        return "batch_evaluate"

    def _route_after_ranking(self, state: ScreeningGraphState) -> str:
        if state.get("skip_reasoning", False):
            return "build_response"
        return "generate_reasoning"

    # ------------------------------------------------------------------ #
    #  Graph nodes                                                         #
    # ------------------------------------------------------------------ #

    async def _batch_evaluate(self, state: ScreeningGraphState) -> dict:
        """Evaluate the next batch of candidates via LLM."""
        idx = state.get("current_batch_index", 0)
        candidates = state["candidates"]
        batch = candidates[idx * BATCH_SIZE : (idx + 1) * BATCH_SIZE]

        logger.info(f"Evaluating batch {idx + 1} ({len(batch)} candidates)")

        prompt_text = self._build_evaluation_prompt(
            state["job"], batch, state["config"]
        )

        response = await self.llm.ainvoke([
            SystemMessage(content="You are an expert talent acquisition specialist."),
            HumanMessage(content=prompt_text),
        ])

        result = json.loads(self._clean_json(response.content))
        if isinstance(result, dict) and "evaluations" in result:
            result = result["evaluations"]
        if not isinstance(result, list):
            result = [result]

        existing = state.get("evaluations", [])
        all_evals = existing + result
        next_idx = idx + 1
        all_done = (next_idx * BATCH_SIZE) >= len(candidates)

        return {
            "evaluations": all_evals,
            "current_batch_index": next_idx,
            "all_batches_done": all_done,
        }

    async def _compute_scores(self, state: ScreeningGraphState) -> dict:
        """Compute weighted overall scores (pure logic, no LLM)."""
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
        """Sort, slice top N, assign ranks and recommendations."""
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
        """Generate recruiter-facing reasoning summaries via LLM."""
        job = state["job"]
        shortlisted = list(state["shortlisted"])
        candidates_map = state["candidates_map"]

        prompt_text = self._build_reasoning_prompt(job, shortlisted, candidates_map)

        response = await self.llm.ainvoke([
            SystemMessage(content="You are a recruiter-facing summary writer."),
            HumanMessage(content=prompt_text),
        ])

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
        """Convert shortlisted dicts into RankedCandidate models."""
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

    # ------------------------------------------------------------------ #
    #  Prompt builders (moved from old screening_workflow.py)              #
    # ------------------------------------------------------------------ #

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
                    f"{s.name} ({s.yearsOfExperience}yr)"
                    for s in candidate.skills[:15]
                ]
            )
            or "None listed"
        )

        edu_str = (
            ", ".join(
                [
                    f"{e.degree} in {e.field} from {e.institution}"
                    for e in candidate.education[:3]
                ]
            )
            or "None listed"
        )

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

    def _build_evaluation_prompt(self, job, batch, config) -> str:
        formatted_candidates = "\n\n".join(
            [self._format_candidate(c, i + 1) for i, c in enumerate(batch)]
        )

        custom_inst = ""
        if config.customInstructions:
            custom_inst = f"\n### Additional Instructions from Recruiter:\n{config.customInstructions}\n"

        prompt = BATCH_EVALUATION_PROMPT.format(
            job_title=job.title,
            job_description=job.description[:2000],
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

    # ------------------------------------------------------------------ #
    #  Utilities                                                           #
    # ------------------------------------------------------------------ #

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

    # ------------------------------------------------------------------ #
    #  Public entry point                                                  #
    # ------------------------------------------------------------------ #

    async def run(self, request: ScreeningRequest) -> ScreeningResponse:
        """Run the screening workflow through the LangGraph pipeline."""
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


# ------------------------------------------------------------------ #
#  Singleton                                                           #
# ------------------------------------------------------------------ #

_service: Optional[ScreeningWorkflowService] = None


def get_screening_service() -> ScreeningWorkflowService:
    """Get or create the screening workflow service singleton."""
    global _service
    if _service is None:
        _service = ScreeningWorkflowService()
    return _service
