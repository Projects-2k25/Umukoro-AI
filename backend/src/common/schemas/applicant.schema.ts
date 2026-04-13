import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import {
  ApplicantSource,
  SkillLevel,
  LanguageProficiency,
  AvailabilityStatus,
  AvailabilityType,
} from '../enums';

@Schema({ _id: false })
export class ApplicantSkill {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: SkillLevel })
  level: SkillLevel;

  @Prop({ default: 0 })
  yearsOfExperience: number;
}

@Schema({ _id: false })
export class Language {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: LanguageProficiency })
  proficiency: LanguageProficiency;
}

@Schema({ _id: false })
export class Experience {
  @Prop()
  company: string;

  @Prop()
  role: string;

  @Prop()
  startDate: string;

  @Prop()
  endDate: string;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop({ default: false })
  isCurrent: boolean;
}

@Schema({ _id: false })
export class Education {
  @Prop()
  institution: string;

  @Prop()
  degree: string;

  @Prop()
  fieldOfStudy: string;

  @Prop()
  startYear: number;

  @Prop()
  endYear: number;
}

@Schema({ _id: false })
export class Certification {
  @Prop()
  name: string;

  @Prop()
  issuer: string;

  @Prop()
  issueDate: string;
}

@Schema({ _id: false })
export class Project {
  @Prop()
  name: string;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  technologies: string[];

  @Prop()
  role: string;

  @Prop()
  link: string;

  @Prop()
  startDate: string;

  @Prop()
  endDate: string;
}

@Schema({ _id: false })
export class Availability {
  @Prop({ type: String, enum: AvailabilityStatus })
  status: AvailabilityStatus;

  @Prop({ type: String, enum: AvailabilityType })
  type: AvailabilityType;

  @Prop()
  startDate: string;
}

@Schema({ _id: false })
export class SocialLinks {
  @Prop()
  linkedin: string;

  @Prop()
  github: string;

  @Prop()
  portfolio: string;
}

@Schema({ timestamps: true, collection: 'applicants' })
export class Applicant extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop({ type: String, enum: ApplicantSource, default: ApplicantSource.MANUAL })
  source: ApplicantSource;

  // 3.1 Basic Information
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  headline: string;

  @Prop({ trim: true })
  bio: string;

  @Prop({ required: true, trim: true })
  location: string;

  // 3.2 Skills & Languages
  @Prop({ type: [ApplicantSkill], default: [] })
  skills: ApplicantSkill[];

  @Prop({ type: [Language], default: [] })
  languages: Language[];

  // 3.3 Work Experience
  @Prop({ type: [Experience], default: [] })
  experience: Experience[];

  // 3.4 Education
  @Prop({ type: [Education], default: [] })
  education: Education[];

  // 3.5 Certifications
  @Prop({ type: [Certification], default: [] })
  certifications: Certification[];

  // 3.6 Projects
  @Prop({ type: [Project], default: [] })
  projects: Project[];

  // 3.7 Availability
  @Prop({ type: Availability })
  availability: Availability;

  // 3.8 Social Links
  @Prop({ type: SocialLinks })
  socialLinks: SocialLinks;

  // --- Internal / system fields (not in hackathon spec) ---
  @Prop({ trim: true })
  phone: string;

  @Prop({ default: 0 })
  totalExperienceYears: number;

  @Prop({ trim: true })
  currentTitle: string;

  @Prop({ trim: true })
  currentCompany: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  rawData: any;

  @Prop()
  resumeFileUrl: string;

  @Prop()
  resumeText: string;

  @Prop()
  umuravaId: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  umuravaProfile: any;
}

export const ApplicantSchema = SchemaFactory.createForClass(Applicant);

ApplicantSchema.index({ jobId: 1 });
ApplicantSchema.index({ jobId: 1, email: 1 });
