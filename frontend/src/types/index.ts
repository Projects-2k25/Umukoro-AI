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

// --- Talent Profile Schema Types (aligned with hackathon spec) ---

export interface ApplicantSkill {
  name: string;
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  yearsOfExperience: number;
}

export interface Language {
  name: string;
  proficiency?: 'Basic' | 'Conversational' | 'Fluent' | 'Native';
}

export interface Experience {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  technologies?: string[];
  isCurrent?: boolean;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startYear?: number;
  endYear?: number;
}

export interface Certification {
  name: string;
  issuer?: string;
  issueDate?: string;
}

export interface Project {
  name: string;
  description?: string;
  technologies?: string[];
  role?: string;
  link?: string;
  startDate?: string;
  endDate?: string;
}

export interface Availability {
  status?: 'Available' | 'Open to Opportunities' | 'Not Available';
  type?: 'Full-time' | 'Part-time' | 'Contract';
  startDate?: string;
}

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface Applicant {
  _id: string;
  jobId: string;
  source: 'UMURAVA_PROFILE' | 'CSV_IMPORT' | 'PDF_UPLOAD' | 'MANUAL';
  // 3.1 Basic Information
  firstName: string;
  lastName: string;
  email: string;
  headline?: string;
  bio?: string;
  location?: string;
  // 3.2 Skills & Languages
  skills: ApplicantSkill[];
  languages?: Language[];
  // 3.3 Work Experience
  experience?: Experience[];
  // 3.4 Education
  education?: Education[];
  // 3.5 Certifications
  certifications?: Certification[];
  // 3.6 Projects
  projects?: Project[];
  // 3.7 Availability
  availability?: Availability;
  // 3.8 Social Links
  socialLinks?: SocialLinks;
  // Internal fields
  phone?: string;
  totalExperienceYears: number;
  currentTitle?: string;
  currentCompany?: string;
  resumeText?: string;
  createdAt: string;
}

// --- Screening Types ---

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
