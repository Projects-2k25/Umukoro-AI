export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'RECRUITER' | 'ADMIN';
  company?: string;
}

export interface RequiredSkill {
  name: string;
  weight: number;
  required: boolean;
}

export interface EducationRequirement {
  level: string;
  field?: string;
  required: boolean;
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  department?: string;
  location?: string;
  employmentType: string;
  requiredSkills: RequiredSkill[];
  experienceLevel: string;
  minExperienceYears: number;
  maxExperienceYears: number;
  educationRequirements: EducationRequirement[];
  salaryRange?: { min: number; max: number; currency: string };
  status: 'DRAFT' | 'OPEN' | 'SCREENING' | 'CLOSED';
  recruiterId: string;
  totalApplicants: number;
  totalScreenings: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicantSkill {
  name: string;
  yearsOfExperience: number;
}

export interface Applicant {
  _id: string;
  jobId: string;
  source: 'UMURAVA_PROFILE' | 'CSV_IMPORT' | 'PDF_UPLOAD' | 'MANUAL';
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  skills: ApplicantSkill[];
  totalExperienceYears: number;
  currentTitle?: string;
  currentCompany?: string;
  workHistory: any[];
  education: any[];
  certifications: string[];
  resumeText?: string;
  createdAt: string;
}

export interface DimensionAnalysis {
  dimension: string;
  score: number;
  rationale: string;
}

export interface ScreeningResult {
  _id: string;
  screeningId: string;
  applicantId: Applicant | string;
  jobId: string;
  rank: number;
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  educationScore: number;
  relevanceScore: number;
  strengths: string[];
  gaps: string[];
  risks: string[];
  recommendation: 'STRONG_YES' | 'YES' | 'MAYBE' | 'NO';
  reasoningSummary: string;
  dimensionAnalysis: DimensionAnalysis[];
  createdAt: string;
}

export interface ScreeningConfig {
  shortlistSize: number;
  weights: {
    skills: number;
    experience: number;
    education: number;
    relevance: number;
  };
  customInstructions?: string;
}

export interface Screening {
  _id: string;
  jobId: Job | string;
  recruiterId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  config: ScreeningConfig;
  totalCandidatesEvaluated: number;
  averageMatchScore: number;
  completedAt?: string;
  processingTimeMs: number;
  aiModel?: string;
  error?: string;
  createdAt: string;
}

export interface DashboardOverview {
  totalJobs: number;
  totalApplicants: number;
  totalScreenings: number;
  completedScreenings: number;
  avgMatchScore: number;
  recentScreenings: Screening[];
  topCandidates: ScreeningResult[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
