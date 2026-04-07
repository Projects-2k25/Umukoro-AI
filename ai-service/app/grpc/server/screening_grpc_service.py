"""
gRPC Screening Service Implementation.
Maps gRPC calls to the existing screening workflow service.

No authentication - internal services are trusted.
"""

import logging
import uuid
from datetime import datetime

from app.grpc.generated import screening_service_pb2, screening_service_pb2_grpc
from app.services.screening_workflow import run_screening, extract_resume
from app.schemas.screening import (
    ScreeningRequest,
    JobInput,
    CandidateInput,
    CandidateSkill,
    WorkHistoryItem,
    EducationItem,
    SkillInput,
    EducationReqInput,
    ScreeningConfigInput,
    ScreeningWeights,
    ResumeExtractionRequest,
)
from app.config.settings import settings

logger = logging.getLogger(__name__)


class ScreeningServicer(screening_service_pb2_grpc.ScreeningServiceServicer):
    """gRPC servicer implementing the ScreeningService interface."""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.info("ScreeningServicer initialized")

    def _generate_request_id(self) -> str:
        return f"grpc-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:8]}"

    async def ScreenCandidates(self, request, context):
        """Screen candidates against job requirements."""
        request_id = request.request_id or self._generate_request_id()
        self.logger.info(
            f"[{request_id}] ScreenCandidates: {len(request.candidates)} candidates for '{request.job.title}'"
        )

        try:
            # Map gRPC request to Pydantic models
            job = JobInput(
                title=request.job.title,
                description=request.job.description,
                requiredSkills=[
                    SkillInput(name=s.name, weight=s.weight or 3, required=s.required)
                    for s in request.job.required_skills
                ],
                experienceLevel=request.job.experience_level or "MID",
                minExperienceYears=request.job.min_experience_years,
                maxExperienceYears=request.job.max_experience_years or 10,
                educationRequirements=[
                    EducationReqInput(level=e.level, field=e.field, required=e.required)
                    for e in request.job.education_requirements
                ],
            )

            candidates = [
                CandidateInput(
                    id=c.id,
                    firstName=c.first_name,
                    lastName=c.last_name,
                    skills=[
                        CandidateSkill(name=s.name, yearsOfExperience=s.years_of_experience)
                        for s in c.skills
                    ],
                    totalExperienceYears=c.total_experience_years,
                    currentTitle=c.current_title,
                    currentCompany=c.current_company,
                    workHistory=[
                        WorkHistoryItem(
                            title=w.title, company=w.company,
                            startDate=w.start_date, endDate=w.end_date,
                            description=w.description,
                        )
                        for w in c.work_history
                    ],
                    education=[
                        EducationItem(
                            degree=e.degree, field=e.field,
                            institution=e.institution, graduationYear=e.graduation_year,
                        )
                        for e in c.education
                    ],
                    certifications=list(c.certifications),
                    resumeText=c.resume_text,
                )
                for c in request.candidates
            ]

            config_weights = ScreeningWeights(
                skills=request.config.weights.skills or 0.3,
                experience=request.config.weights.experience or 0.25,
                education=request.config.weights.education or 0.2,
                relevance=request.config.weights.relevance or 0.25,
            )

            config = ScreeningConfigInput(
                shortlistSize=request.config.shortlist_size or 10,
                weights=config_weights,
                customInstructions=request.config.custom_instructions or "",
            )

            screening_request = ScreeningRequest(
                job=job, candidates=candidates, config=config,
            )

            # Run the screening workflow
            result = await run_screening(screening_request)

            # Map back to gRPC response
            grpc_results = []
            for r in result.results:
                grpc_results.append(
                    screening_service_pb2.RankedCandidate(
                        candidate_id=r.candidateId,
                        rank=r.rank,
                        overall_score=r.overallScore,
                        skills_score=r.skillsScore,
                        experience_score=r.experienceScore,
                        education_score=r.educationScore,
                        relevance_score=r.relevanceScore,
                        strengths=r.strengths,
                        gaps=r.gaps,
                        risks=r.risks,
                        recommendation=r.recommendation,
                        reasoning_summary=r.reasoningSummary,
                        dimension_analysis=[
                            screening_service_pb2.DimensionAnalysis(
                                dimension=d.dimension, score=d.score, rationale=d.rationale,
                            )
                            for d in r.dimensionAnalysis
                        ],
                    )
                )

            return screening_service_pb2.ScreenCandidatesResponse(
                success=True,
                results=grpc_results,
                metadata=screening_service_pb2.ScreeningMetadata(
                    total_evaluated=result.metadata.totalEvaluated,
                    processing_time_ms=result.metadata.processingTimeMs,
                    model=result.metadata.model,
                ),
            )

        except Exception as e:
            self.logger.error(f"[{request_id}] ScreenCandidates error: {e}")
            return screening_service_pb2.ScreenCandidatesResponse(
                success=False, error=str(e),
            )

    async def ExtractResume(self, request, context):
        """Extract structured profile from resume text."""
        request_id = request.request_id or self._generate_request_id()
        self.logger.info(f"[{request_id}] ExtractResume ({len(request.resume_text)} chars)")

        try:
            extraction_request = ResumeExtractionRequest(resume_text=request.resume_text)
            result = await extract_resume(extraction_request)

            return screening_service_pb2.ExtractResumeResponse(
                success=True,
                first_name=result.firstName,
                last_name=result.lastName,
                email=result.email,
                phone=result.phone,
                skills=[
                    screening_service_pb2.CandidateSkill(
                        name=s.name, years_of_experience=s.yearsOfExperience,
                    )
                    for s in result.skills
                ],
                total_experience_years=result.totalExperienceYears,
                current_title=result.currentTitle,
                current_company=result.currentCompany,
                work_history=[
                    screening_service_pb2.WorkHistoryItem(
                        title=w.title or "", company=w.company or "",
                        start_date=w.startDate or "", end_date=w.endDate or "",
                        description=w.description or "",
                    )
                    for w in result.workHistory
                ],
                education=[
                    screening_service_pb2.EducationItem(
                        degree=e.degree or "", field=e.field or "",
                        institution=e.institution or "",
                        graduation_year=e.graduationYear or 0,
                    )
                    for e in result.education
                ],
                certifications=result.certifications,
            )

        except Exception as e:
            self.logger.error(f"[{request_id}] ExtractResume error: {e}")
            return screening_service_pb2.ExtractResumeResponse(
                success=False, error=str(e),
            )

    async def HealthCheck(self, request, context):
        """Health check endpoint."""
        return screening_service_pb2.HealthCheckResponse(
            healthy=True,
            status="SERVING",
            service="talentlens-ai-service",
            version="1.0.0",
            message="Screening service is healthy",
        )
