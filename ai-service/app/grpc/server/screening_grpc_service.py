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
    LanguageItem,
    ExperienceItem,
    EducationItem,
    CertificationItem,
    ProjectItem,
    AvailabilityItem,
    SocialLinksItem,
    SkillInput,
    EducationReqInput,
    ScreeningConfigInput,
    ScreeningWeights,
    ResumeExtractionRequest,
)
from app.config.settings import settings

logger = logging.getLogger(__name__)


class ScreeningServicer(screening_service_pb2_grpc.ScreeningServiceServicer):
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.info("ScreeningServicer initialized")

    def _generate_request_id(self) -> str:
        return f"grpc-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:8]}"

    async def ScreenCandidates(self, request, context):
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
                    email=c.email or "",
                    headline=c.headline or "",
                    bio=c.bio or "",
                    location=c.location or "",
                    skills=[
                        CandidateSkill(
                            name=s.name,
                            level=s.level or "Intermediate",
                            yearsOfExperience=s.years_of_experience,
                        )
                        for s in c.skills
                    ],
                    languages=[
                        LanguageItem(name=l.name, proficiency=l.proficiency or "Fluent")
                        for l in c.languages
                    ],
                    experience=[
                        ExperienceItem(
                            company=w.company, role=w.role,
                            startDate=w.start_date, endDate=w.end_date,
                            description=w.description,
                            technologies=list(w.technologies),
                            isCurrent=w.is_current,
                        )
                        for w in c.experience
                    ],
                    education=[
                        EducationItem(
                            institution=e.institution, degree=e.degree,
                            fieldOfStudy=e.field_of_study,
                            startYear=e.start_year or None,
                            endYear=e.end_year or None,
                        )
                        for e in c.education
                    ],
                    certifications=[
                        CertificationItem(
                            name=cert.name, issuer=cert.issuer,
                            issueDate=cert.issue_date,
                        )
                        for cert in c.certifications
                    ],
                    projects=[
                        ProjectItem(
                            name=p.name, description=p.description,
                            technologies=list(p.technologies),
                            role=p.role, link=p.link,
                            startDate=p.start_date, endDate=p.end_date,
                        )
                        for p in c.projects
                    ],
                    availability=AvailabilityItem(
                        status=c.availability.status or "Available",
                        type=c.availability.type or "Full-time",
                        startDate=c.availability.start_date or None,
                    ) if c.availability and c.availability.status else None,
                    socialLinks=SocialLinksItem(
                        linkedin=c.social_links.linkedin or "",
                        github=c.social_links.github or "",
                        portfolio=c.social_links.portfolio or "",
                    ) if c.social_links else None,
                    totalExperienceYears=c.total_experience_years,
                    currentTitle=c.current_title,
                    currentCompany=c.current_company,
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
                headline=result.headline or "",
                bio=result.bio or "",
                location=result.location or "",
                skills=[
                    screening_service_pb2.CandidateSkill(
                        name=s.name,
                        level=s.level or "Intermediate",
                        years_of_experience=s.yearsOfExperience,
                    )
                    for s in result.skills
                ],
                languages=[
                    screening_service_pb2.LanguageItem(
                        name=l.name, proficiency=l.proficiency or "Fluent",
                    )
                    for l in result.languages
                ],
                experience=[
                    screening_service_pb2.ExperienceItem(
                        company=w.company or "", role=w.role or "",
                        start_date=w.startDate or "", end_date=w.endDate or "",
                        description=w.description or "",
                        technologies=w.technologies or [],
                        is_current=w.isCurrent or False,
                    )
                    for w in result.experience
                ],
                education=[
                    screening_service_pb2.EducationItem(
                        institution=e.institution or "", degree=e.degree or "",
                        field_of_study=e.fieldOfStudy or "",
                        start_year=e.startYear or 0,
                        end_year=e.endYear or 0,
                    )
                    for e in result.education
                ],
                certifications=[
                    screening_service_pb2.CertificationItem(
                        name=c.name or "", issuer=c.issuer or "",
                        issue_date=c.issueDate or "",
                    )
                    for c in result.certifications
                ],
                projects=[
                    screening_service_pb2.ProjectItem(
                        name=p.name or "", description=p.description or "",
                        technologies=p.technologies or [],
                        role=p.role or "", link=p.link or "",
                        start_date=p.startDate or "", end_date=p.endDate or "",
                    )
                    for p in result.projects
                ],
                availability=screening_service_pb2.AvailabilityItem(
                    status=result.availability.status or "",
                    type=result.availability.type or "",
                    start_date=result.availability.startDate or "",
                ) if result.availability else None,
                social_links=screening_service_pb2.SocialLinksItem(
                    linkedin=result.socialLinks.linkedin or "",
                    github=result.socialLinks.github or "",
                    portfolio=result.socialLinks.portfolio or "",
                ) if result.socialLinks else None,
                phone=result.phone or "",
                total_experience_years=result.totalExperienceYears,
                current_title=result.currentTitle or "",
                current_company=result.currentCompany or "",
            )

        except Exception as e:
            self.logger.error(f"[{request_id}] ExtractResume error: {e}")
            return screening_service_pb2.ExtractResumeResponse(
                success=False, error=str(e),
            )

    async def HealthCheck(self, request, context):
        return screening_service_pb2.HealthCheckResponse(
            healthy=True,
            status="SERVING",
            service="umukoro-ai-service",
            version="1.0.0",
            message="Screening service is healthy",
        )
