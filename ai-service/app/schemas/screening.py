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


class CandidateSkill(BaseModel):
    name: str
    yearsOfExperience: float = 0


class WorkHistoryItem(BaseModel):
    title: Optional[str] = ""
    company: Optional[str] = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    description: Optional[str] = ""


class EducationItem(BaseModel):
    degree: Optional[str] = ""
    field: Optional[str] = ""
    institution: Optional[str] = ""
    graduationYear: Optional[int] = None


class CandidateInput(BaseModel):
    id: str
    firstName: str
    lastName: str
    skills: list[CandidateSkill] = []
    totalExperienceYears: float = 0
    currentTitle: Optional[str] = ""
    currentCompany: Optional[str] = ""
    workHistory: list[WorkHistoryItem] = []
    education: list[EducationItem] = []
    certifications: list[str] = []
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


class ExtractedProfile(BaseModel):
    firstName: str = ""
    lastName: str = ""
    email: str = ""
    phone: str = ""
    skills: list[CandidateSkill] = []
    totalExperienceYears: float = 0
    currentTitle: str = ""
    currentCompany: str = ""
    workHistory: list[WorkHistoryItem] = []
    education: list[EducationItem] = []
    certifications: list[str] = []
