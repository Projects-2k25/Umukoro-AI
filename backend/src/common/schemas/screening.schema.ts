import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ScreeningStatus } from '../enums';

@Schema({ _id: false })
export class ScreeningWeights {
  @Prop({ default: 0.3 })
  skills: number;

  @Prop({ default: 0.25 })
  experience: number;

  @Prop({ default: 0.2 })
  education: number;

  @Prop({ default: 0.25 })
  relevance: number;
}

@Schema({ _id: false })
export class ScreeningConfig {
  @Prop({ default: 10 })
  shortlistSize: number;

  @Prop({ type: ScreeningWeights, default: () => ({}) })
  weights: ScreeningWeights;

  @Prop()
  customInstructions: string;
}

@Schema({ timestamps: true, collection: 'screenings' })
export class Screening extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recruiterId: Types.ObjectId;

  @Prop({ type: String, enum: ScreeningStatus, default: ScreeningStatus.PENDING })
  status: ScreeningStatus;

  @Prop({ type: ScreeningConfig, default: () => ({}) })
  config: ScreeningConfig;

  @Prop({ default: 0 })
  totalCandidatesEvaluated: number;

  @Prop({ default: 0 })
  averageMatchScore: number;

  @Prop()
  completedAt: Date;

  @Prop({ default: 0 })
  processingTimeMs: number;

  @Prop()
  aiModel: string;

  @Prop()
  error: string;

  @Prop({ default: 0 })
  progressBatchesDone: number;

  @Prop({ default: 0 })
  progressBatchesTotal: number;

  @Prop({ default: 0 })
  progressCandidatesDone: number;
}

export const ScreeningSchema = SchemaFactory.createForClass(Screening);

ScreeningSchema.index({ jobId: 1, createdAt: -1 });
ScreeningSchema.index({ recruiterId: 1 });
