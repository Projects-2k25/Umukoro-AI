import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Screening } from '../../common/schemas/screening.schema';
import { ScreeningResult } from '../../common/schemas/screening-result.schema';
import { Job } from '../../common/schemas/job.schema';
import { Applicant } from '../../common/schemas/applicant.schema';
import { ScreeningStatus, JobStatus } from '../../common/enums';
import { CreateScreeningDto } from './screenings.dto';
import { ScreeningServiceClient } from '../../grpc/screening-service.client';

@Injectable()
export class ScreeningsService {
  private readonly logger = new Logger(ScreeningsService.name);

  constructor(
    @InjectModel(Screening.name) private screeningModel: Model<Screening>,
    @InjectModel(ScreeningResult.name) private resultModel: Model<ScreeningResult>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(Applicant.name) private applicantModel: Model<Applicant>,
    private configService: ConfigService,
    private readonly screeningClient: ScreeningServiceClient,
  ) {}

  async create(dto: CreateScreeningDto, recruiterId: string) {
    const job = await this.jobModel.findOne({
      _id: dto.jobId,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    if (!job) throw new NotFoundException('Job not found');

    const applicants = await this.applicantModel.find({ jobId: job._id });
    if (applicants.length === 0) {
      throw new BadRequestException('No applicants found for this job');
    }

    const screening = await this.screeningModel.create({
      jobId: job._id,
      recruiterId: new Types.ObjectId(recruiterId),
      status: ScreeningStatus.PROCESSING,
      config: {
        shortlistSize: dto.config?.shortlistSize || 10,
        weights: dto.config?.weights || { skills: 0.3, experience: 0.25, education: 0.2, relevance: 0.25 },
        customInstructions: dto.config?.customInstructions || '',
      },
      totalCandidatesEvaluated: applicants.length,
    });

    await this.jobModel.findByIdAndUpdate(job._id, {
      status: JobStatus.SCREENING,
      $inc: { totalScreenings: 1 },
    });

    const startTime = Date.now();

    try {
      const aiPayload = {
        job: {
          title: job.title,
          description: job.description,
          requiredSkills: job.requiredSkills,
          experienceLevel: job.experienceLevel,
          minExperienceYears: job.minExperienceYears,
          maxExperienceYears: job.maxExperienceYears,
          educationRequirements: job.educationRequirements,
        },
        candidates: applicants.map((a) => ({
          id: a._id.toString(),
          firstName: a.firstName,
          lastName: a.lastName,
          headline: a.headline || '',
          bio: a.bio || '',
          location: a.location || '',
          skills: a.skills,
          languages: a.languages || [],
          totalExperienceYears: a.totalExperienceYears,
          currentTitle: a.currentTitle,
          currentCompany: a.currentCompany,
          experience: a.experience || [],
          education: a.education,
          certifications: a.certifications,
          projects: a.projects || [],
          availability: a.availability || {},
          socialLinks: a.socialLinks || {},
          resumeText: a.resumeText || '',
        })),
        config: {
          shortlistSize: screening.config.shortlistSize,
          weights: screening.config.weights,
          customInstructions: screening.config.customInstructions,
        },
      };

      // Try gRPC first, fall back to HTTP
      let aiResponse = await this.callAiServiceGrpc(aiPayload);

      if (!aiResponse) {
        this.logger.log('gRPC unavailable, falling back to HTTP');
        aiResponse = await this.callAiServiceHttp(aiPayload);
      }

      const aiResults = aiResponse.results || [];

      const screeningResults = aiResults.map((r: any) => ({
        screeningId: screening._id,
        applicantId: new Types.ObjectId(r.candidateId),
        jobId: job._id,
        rank: r.rank,
        overallScore: r.overallScore,
        skillsScore: r.skillsScore,
        experienceScore: r.experienceScore,
        educationScore: r.educationScore,
        relevanceScore: r.relevanceScore,
        strengths: r.strengths || [],
        gaps: r.gaps || [],
        risks: r.risks || [],
        recommendation: r.recommendation,
        reasoningSummary: r.reasoningSummary,
        dimensionAnalysis: r.dimensionAnalysis || [],
      }));

      if (screeningResults.length > 0) {
        await this.resultModel.insertMany(screeningResults);
      }

      const avgScore =
        screeningResults.length > 0
          ? screeningResults.reduce((sum: number, r: any) => sum + r.overallScore, 0) / screeningResults.length
          : 0;

      await this.screeningModel.findByIdAndUpdate(screening._id, {
        status: ScreeningStatus.COMPLETED,
        completedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        averageMatchScore: Math.round(avgScore),
        aiModel: aiResponse.metadata?.model || 'gemini-2.0-flash',
      });

      await this.jobModel.findByIdAndUpdate(job._id, { status: JobStatus.OPEN });

      return this.findById(screening._id.toString());
    } catch (error: any) {
      await this.screeningModel.findByIdAndUpdate(screening._id, {
        status: ScreeningStatus.FAILED,
        error: error.message || 'AI service error',
        processingTimeMs: Date.now() - startTime,
      });

      await this.jobModel.findByIdAndUpdate(job._id, { status: JobStatus.OPEN });

      throw new BadRequestException(`Screening failed: ${error.message}`);
    }
  }

  private async callAiServiceGrpc(payload: any): Promise<any | null> {
    try {
      const result = await this.screeningClient.screenCandidates(payload);
      if (result) {
        this.logger.log(`Screening completed via gRPC: ${result.results?.length} results`);
      }
      return result;
    } catch (error: any) {
      this.logger.warn(`gRPC call failed: ${error.message}`);
      return null;
    }
  }

  private async callAiServiceHttp(payload: any): Promise<any> {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
    const response = await axios.post(`${aiServiceUrl}/api/v1/screen`, payload, {
      timeout: 120000,
    });
    this.logger.log(`Screening completed via HTTP: ${response.data.results?.length} results`);
    return response.data;
  }

  async findAll(jobId?: string, recruiterId?: string) {
    const filter: any = {};
    if (jobId) filter.jobId = new Types.ObjectId(jobId);
    if (recruiterId) filter.recruiterId = new Types.ObjectId(recruiterId);

    return this.screeningModel.find(filter).sort({ createdAt: -1 }).populate('jobId', 'title');
  }

  async findById(id: string) {
    const screening = await this.screeningModel.findById(id).populate('jobId', 'title description');
    if (!screening) throw new NotFoundException('Screening not found');

    const results = await this.resultModel
      .find({ screeningId: screening._id })
      .sort({ rank: 1 })
      .populate('applicantId', 'firstName lastName email headline location currentTitle currentCompany skills education experience projects availability');

    return { screening, results };
  }

  async getResults(id: string, limit?: number) {
    const screening = await this.screeningModel.findById(id);
    if (!screening) throw new NotFoundException('Screening not found');

    const query = this.resultModel
      .find({ screeningId: screening._id })
      .sort({ rank: 1 })
      .populate('applicantId', 'firstName lastName email headline location currentTitle currentCompany skills education experience projects availability totalExperienceYears');

    if (limit) query.limit(limit);

    const results = await query;
    return { screening, results };
  }
}
