import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { JobStatus, ExperienceLevel, EmploymentType, EducationLevel } from '../enums';

@Schema({ _id: false })
export class RequiredSkill {
  @Prop({ required: true })
  name: string;

  @Prop({ default: 3, min: 1, max: 5 })
  weight: number;

  @Prop({ default: false })
  required: boolean;
}

@Schema({ _id: false })
export class EducationRequirement {
  @Prop({ type: String, enum: EducationLevel, required: true })
  level: EducationLevel;

  @Prop()
  field: string;

  @Prop({ default: false })
  required: boolean;
}

@Schema({ _id: false })
export class SalaryRange {
  @Prop()
  min: number;

  @Prop()
  max: number;

  @Prop({ default: 'RWF' })
  currency: string;
}

@Schema({ timestamps: true, collection: 'jobs' })
export class Job extends Document {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ trim: true })
  department: string;

  @Prop({ trim: true })
  location: string;

  @Prop({ type: String, enum: EmploymentType, default: EmploymentType.FULL_TIME })
  employmentType: EmploymentType;

  @Prop({ type: [RequiredSkill], default: [] })
  requiredSkills: RequiredSkill[];

  @Prop({ type: String, enum: ExperienceLevel, default: ExperienceLevel.MID })
  experienceLevel: ExperienceLevel;

  @Prop({ default: 0 })
  minExperienceYears: number;

  @Prop({ default: 10 })
  maxExperienceYears: number;

  @Prop({ type: [EducationRequirement], default: [] })
  educationRequirements: EducationRequirement[];

  @Prop({ type: SalaryRange })
  salaryRange: SalaryRange;

  @Prop({ type: String, enum: JobStatus, default: JobStatus.DRAFT })
  status: JobStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recruiterId: Types.ObjectId;

  @Prop({ default: 0 })
  totalApplicants: number;

  @Prop({ default: 0 })
  totalScreenings: number;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ recruiterId: 1, status: 1 });
JobSchema.index({ createdAt: -1 });
