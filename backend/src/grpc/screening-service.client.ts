import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { lastValueFrom, Observable, timeout, retry, catchError, throwError } from 'rxjs';

interface ScreeningService {
  ScreenCandidates(data: any): Observable<any>;
  ExtractResume(data: any): Observable<any>;
  HealthCheck(data: any): Observable<any>;
}

@Injectable()
export class ScreeningServiceClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScreeningServiceClient.name);
  private screeningService: ScreeningService;

  constructor(
    @Inject('SCREENING_SERVICE') private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    try {
      this.screeningService = this.client.getService<ScreeningService>('ScreeningService');
      this.logger.log('Screening Service gRPC client initialized');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('Screening service gRPC not available, will use HTTP fallback');
        this.screeningService = null;
      } else {
        this.logger.error('Failed to initialize Screening Service gRPC client:', error.message);
        throw error;
      }
    }
  }

  onModuleDestroy() {
    this.logger.log('Screening Service gRPC client destroyed');
  }

  /**
   * Screen candidates via gRPC.
   * Returns null if gRPC is unavailable (caller should fall back to HTTP).
   */
  async screenCandidates(payload: {
    job: any;
    candidates: any[];
    config: any;
  }): Promise<any | null> {
    if (!this.screeningService) return null;

    try {
      const grpcPayload = {
        job: {
          title: payload.job.title,
          description: payload.job.description,
          required_skills: (payload.job.requiredSkills || []).map((s: any) => ({
            name: s.name,
            weight: s.weight || 3,
            required: s.required || false,
          })),
          experience_level: payload.job.experienceLevel || 'MID',
          min_experience_years: payload.job.minExperienceYears || 0,
          max_experience_years: payload.job.maxExperienceYears || 10,
          education_requirements: (payload.job.educationRequirements || []).map((e: any) => ({
            level: e.level,
            field: e.field || '',
            required: e.required || false,
          })),
        },
        candidates: payload.candidates.map((c: any) => ({
          id: c.id,
          first_name: c.firstName,
          last_name: c.lastName,
          skills: (c.skills || []).map((s: any) => ({
            name: s.name,
            years_of_experience: s.yearsOfExperience || 0,
          })),
          total_experience_years: c.totalExperienceYears || 0,
          current_title: c.currentTitle || '',
          current_company: c.currentCompany || '',
          work_history: (c.workHistory || []).map((w: any) => ({
            title: w.title || '',
            company: w.company || '',
            start_date: w.startDate || '',
            end_date: w.endDate || '',
            description: w.description || '',
          })),
          education: (c.education || []).map((e: any) => ({
            degree: e.degree || '',
            field: e.field || '',
            institution: e.institution || '',
            graduation_year: e.graduationYear || 0,
          })),
          certifications: c.certifications || [],
          resume_text: c.resumeText || '',
        })),
        config: {
          shortlist_size: payload.config.shortlistSize || 10,
          weights: {
            skills: payload.config.weights?.skills || 0.3,
            experience: payload.config.weights?.experience || 0.25,
            education: payload.config.weights?.education || 0.2,
            relevance: payload.config.weights?.relevance || 0.25,
          },
          custom_instructions: payload.config.customInstructions || '',
        },
        request_id: `scr_${Date.now()}`,
      };

      const response = await lastValueFrom(
        this.screeningService.ScreenCandidates(grpcPayload).pipe(
          timeout(120000),
          retry({ count: 1, delay: 3000 }),
          catchError((error) => {
            this.logger.warn(`gRPC ScreenCandidates failed: ${error.message}`);
            return throwError(() => error);
          }),
        ),
      );

      if (!response?.success) {
        this.logger.warn(`gRPC screening returned error: ${response?.error}`);
        return null;
      }

      // Map snake_case gRPC response back to camelCase
      return {
        results: (response.results || []).map((r: any) => ({
          candidateId: r.candidate_id,
          rank: r.rank,
          overallScore: r.overall_score,
          skillsScore: r.skills_score,
          experienceScore: r.experience_score,
          educationScore: r.education_score,
          relevanceScore: r.relevance_score,
          strengths: r.strengths || [],
          gaps: r.gaps || [],
          risks: r.risks || [],
          recommendation: r.recommendation,
          reasoningSummary: r.reasoning_summary,
          dimensionAnalysis: (r.dimension_analysis || []).map((d: any) => ({
            dimension: d.dimension,
            score: d.score,
            rationale: d.rationale,
          })),
        })),
        metadata: {
          totalEvaluated: response.metadata?.total_evaluated || 0,
          processingTimeMs: response.metadata?.processing_time_ms || 0,
          model: response.metadata?.model || 'gemini-2.0-flash',
        },
      };
    } catch (error) {
      this.logger.warn(`gRPC ScreenCandidates exception: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract resume via gRPC.
   * Returns null if gRPC is unavailable.
   */
  async extractResume(resumeText: string): Promise<any | null> {
    if (!this.screeningService) return null;

    try {
      const response = await lastValueFrom(
        this.screeningService.ExtractResume({
          resume_text: resumeText,
          request_id: `ext_${Date.now()}`,
        }).pipe(
          timeout(60000),
          retry({ count: 1, delay: 2000 }),
          catchError((error) => {
            this.logger.warn(`gRPC ExtractResume failed: ${error.message}`);
            return throwError(() => error);
          }),
        ),
      );

      if (!response?.success) return null;

      return {
        firstName: response.first_name,
        lastName: response.last_name,
        email: response.email,
        phone: response.phone,
        skills: (response.skills || []).map((s: any) => ({
          name: s.name,
          yearsOfExperience: s.years_of_experience || 0,
        })),
        totalExperienceYears: response.total_experience_years || 0,
        currentTitle: response.current_title,
        currentCompany: response.current_company,
        workHistory: (response.work_history || []).map((w: any) => ({
          title: w.title,
          company: w.company,
          startDate: w.start_date,
          endDate: w.end_date,
          description: w.description,
        })),
        education: (response.education || []).map((e: any) => ({
          degree: e.degree,
          field: e.field,
          institution: e.institution,
          graduationYear: e.graduation_year,
        })),
        certifications: response.certifications || [],
      };
    } catch (error) {
      this.logger.warn(`gRPC ExtractResume exception: ${error.message}`);
      return null;
    }
  }
}
