export enum UserRole {
  RECRUITER = 'RECRUITER',
  ADMIN = 'ADMIN',
}

export enum JobStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  SCREENING = 'SCREENING',
  CLOSED = 'CLOSED',
}

export enum ExperienceLevel {
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD',
}

export enum EducationLevel {
  HIGH_SCHOOL = 'HIGH_SCHOOL',
  DIPLOMA = 'DIPLOMA',
  CERTIFICATE = 'CERTIFICATE',
  BACHELORS = 'BACHELORS',
  MASTERS = 'MASTERS',
  PHD = 'PHD',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
}

export enum ApplicantSource {
  UMURAVA_PROFILE = 'UMURAVA_PROFILE',
  CSV_IMPORT = 'CSV_IMPORT',
  PDF_UPLOAD = 'PDF_UPLOAD',
  MANUAL = 'MANUAL',
}

export enum ScreeningStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum Recommendation {
  STRONG_YES = 'STRONG_YES',
  YES = 'YES',
  MAYBE = 'MAYBE',
  NO = 'NO',
}

export enum SkillLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced',
  EXPERT = 'Expert',
}

export enum LanguageProficiency {
  BASIC = 'Basic',
  CONVERSATIONAL = 'Conversational',
  FLUENT = 'Fluent',
  NATIVE = 'Native',
}

export enum AvailabilityStatus {
  AVAILABLE = 'Available',
  OPEN_TO_OPPORTUNITIES = 'Open to Opportunities',
  NOT_AVAILABLE = 'Not Available',
}

export enum AvailabilityType {
  FULL_TIME = 'Full-time',
  PART_TIME = 'Part-time',
  CONTRACT = 'Contract',
}
