import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Recommendation } from '../enums';

@Schema({ _id: false })
export class DimensionAnalysis {
  @Prop({ required: true })
  dimension: string;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  rationale: string;
}

@Schema({ timestamps: true, collection: 'screening_results' })
export class ScreeningResult extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Screening', required: true })
  screeningId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Applicant', required: true })
  applicantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop({ required: true })
  rank: number;

  @Prop({ required: true, min: 0, max: 100 })
  overallScore: number;

  @Prop({ min: 0, max: 100 })
  skillsScore: number;

  @Prop({ min: 0, max: 100 })
  experienceScore: number;

  @Prop({ min: 0, max: 100 })
  educationScore: number;

  @Prop({ min: 0, max: 100 })
  relevanceScore: number;

  @Prop({ type: [String], default: [] })
  strengths: string[];

  @Prop({ type: [String], default: [] })
  gaps: string[];

  @Prop({ type: [String], default: [] })
  risks: string[];

  @Prop({ type: String, enum: Recommendation, default: Recommendation.MAYBE })
  recommendation: Recommendation;

  @Prop()
  reasoningSummary: string;

  @Prop({ type: [DimensionAnalysis], default: [] })
  dimensionAnalysis: DimensionAnalysis[];
}

export const ScreeningResultSchema = SchemaFactory.createForClass(ScreeningResult);

ScreeningResultSchema.index({ screeningId: 1, rank: 1 });
ScreeningResultSchema.index({ applicantId: 1 });
ScreeningResultSchema.index({ jobId: 1 });
