from typing import Optional
from pydantic import BaseModel, Field


class SkillInput(BaseModel):
    name: str
    weight: int = 3
    required: bool = False


class EducationReqInput(BaseModel):
    level: str
    field: Optional[str] = None
    required: bool = False


class JobInput(BaseModel):
    title: str
    description: str
    requiredSkills: list[SkillInput] = []
    experienceLevel: str = "MID"
    minExperienceYears: int = 0
    maxExperienceYears: int = 10
    educationRequirements: list[EducationReqInput] = []


# --- Talent Profile Schema (aligned with hackathon spec) ---


class CandidateSkill(BaseModel):
    name: str
    level: Optional[str] = "Intermediate"
    yearsOfExperience: float = 0


class LanguageItem(BaseModel):
    name: str
    proficiency: Optional[str] = "Fluent"


class ExperienceItem(BaseModel):
    company: Optional[str] = ""
    role: Optional[str] = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = ""
    technologies: list[str] = []
    isCurrent: bool = False


class EducationItem(BaseModel):
    institution: Optional[str] = ""
    degree: Optional[str] = ""
    fieldOfStudy: Optional[str] = ""
    startYear: Optional[int] = None
    endYear: Optional[int] = None


class CertificationItem(BaseModel):
    name: Optional[str] = ""
    issuer: Optional[str] = ""
    issueDate: Optional[str] = ""


class ProjectItem(BaseModel):
    name: Optional[str] = ""
    description: Optional[str] = ""
    technologies: list[str] = []
    role: Optional[str] = ""
    link: Optional[str] = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None


class AvailabilityItem(BaseModel):
    status: Optional[str] = "Available"
    type: Optional[str] = "Full-time"
    startDate: Optional[str] = None


class SocialLinksItem(BaseModel):
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""


class CandidateInput(BaseModel):
    id: str
    # 3.1 Basic Information
    firstName: str
    lastName: str
    email: Optional[str] = ""
    headline: Optional[str] = ""
    bio: Optional[str] = ""
    location: Optional[str] = ""
    # 3.2 Skills & Languages
    skills: list[CandidateSkill] = []
    languages: list[LanguageItem] = []
    # 3.3 Work Experience
    experience: list[ExperienceItem] = []
    # 3.4 Education
    education: list[EducationItem] = []
    # 3.5 Certifications
    certifications: list[CertificationItem] = []
    # 3.6 Projects
    projects: list[ProjectItem] = []
    # 3.7 Availability
    availability: Optional[AvailabilityItem] = None
    # 3.8 Social Links
    socialLinks: Optional[SocialLinksItem] = None
    # Internal fields (not in spec but useful for AI)
    totalExperienceYears: float = 0
    currentTitle: Optional[str] = ""
    currentCompany: Optional[str] = ""
    resumeText: Optional[str] = ""


class ScreeningWeights(BaseModel):
    skills: float = 0.30
    experience: float = 0.25
    education: float = 0.20
    relevance: float = 0.25


class ScreeningConfigInput(BaseModel):
    shortlistSize: int = 10
    weights: ScreeningWeights = ScreeningWeights()
    customInstructions: Optional[str] = ""


class ScreeningRequest(BaseModel):
    job: JobInput
    candidates: list[CandidateInput]
    config: ScreeningConfigInput = ScreeningConfigInput()
    screeningId: Optional[str] = None


class DimensionAnalysis(BaseModel):
    dimension: str
    score: int = Field(ge=0, le=100)
    rationale: str


class CandidateEvaluation(BaseModel):
    candidateId: str
    skillsScore: int = Field(ge=0, le=100)
    experienceScore: int = Field(ge=0, le=100)
    educationScore: int = Field(ge=0, le=100)
    relevanceScore: int = Field(ge=0, le=100)
    strengths: list[str]
    gaps: list[str]
    risks: list[str] = []
    dimensionAnalysis: list[DimensionAnalysis] = []


class RankedCandidate(BaseModel):
    candidateId: str
    rank: int
    overallScore: int
    skillsScore: int
    experienceScore: int
    educationScore: int
    relevanceScore: int
    strengths: list[str]
    gaps: list[str]
    risks: list[str] = []
    recommendation: str
    reasoningSummary: str = ""
    dimensionAnalysis: list[DimensionAnalysis] = []


class ScreeningMetadata(BaseModel):
    totalEvaluated: int
    processingTimeMs: int
    model: str
    promptTokens: int = 0
    completionTokens: int = 0


class ScreeningResponse(BaseModel):
    results: list[RankedCandidate]
    metadata: ScreeningMetadata


class ResumeExtractionRequest(BaseModel):
    resumeText: str


class HeaderMappingRequest(BaseModel):
    headers: list[str]
    sampleRow: dict = {}


class HeaderMappingResponse(BaseModel):
    mapping: dict = {}
    notes: str = ""


class ExtractedProfile(BaseModel):
    # 3.1 Basic Information
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    headline: str = ""
    bio: str = ""
    location: str = ""
    # 3.2 Skills & Languages
    skills: list[CandidateSkill] = []
    languages: list[LanguageItem] = []
    # 3.3 Work Experience
    experience: list[ExperienceItem] = []
    # 3.4 Education
    education: list[EducationItem] = []
    # 3.5 Certifications
    certifications: list[CertificationItem] = []
    # 3.6 Projects
    projects: list[ProjectItem] = []
    # 3.7 Availability
    availability: Optional[AvailabilityItem] = None
    # 3.8 Social Links
    socialLinks: Optional[SocialLinksItem] = None
    # Internal
    phone: str = ""
    totalExperienceYears: float = 0
    currentTitle: str = ""
    currentCompany: str = ""
