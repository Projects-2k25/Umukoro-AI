import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { ApplicantSource, EducationLevel } from '../enums';

@Schema({ _id: false })
export class ApplicantSkill {
  @Prop({ required: true })
  name: string;

  @Prop({ default: 0 })
  yearsOfExperience: number;
}

@Schema({ _id: false })
export class WorkHistory {
  @Prop()
  title: string;

  @Prop()
  company: string;

  @Prop()
  startDate: Date;

  @Prop()
  endDate: Date;

  @Prop()
  description: string;
}

@Schema({ _id: false })
export class Education {
  @Prop({ type: String, enum: EducationLevel })
  degree: EducationLevel;

  @Prop()
  field: string;

  @Prop()
  institution: string;

  @Prop()
  graduationYear: number;
}

@Schema({ timestamps: true, collection: 'applicants' })
export class Applicant extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop({ type: String, enum: ApplicantSource, default: ApplicantSource.MANUAL })
  source: ApplicantSource;

  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ type: [ApplicantSkill], default: [] })
  skills: ApplicantSkill[];

  @Prop({ default: 0 })
  totalExperienceYears: number;

  @Prop({ trim: true })
  currentTitle: string;

  @Prop({ trim: true })
  currentCompany: string;

  @Prop({ type: [WorkHistory], default: [] })
  workHistory: WorkHistory[];

  @Prop({ type: [Education], default: [] })
  education: Education[];

  @Prop({ type: [String], default: [] })
  certifications: string[];

  @Prop()
  portfolioUrl: string;

  @Prop()
  linkedinUrl: string;

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
