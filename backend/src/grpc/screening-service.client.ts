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
          email: c.email || '',
          headline: c.headline || '',
          bio: c.bio || '',
          location: c.location || '',
          skills: (c.skills || []).map((s: any) => ({
            name: s.name,
            level: s.level || 'Intermediate',
            years_of_experience: s.yearsOfExperience || 0,
          })),
          languages: (c.languages || []).map((l: any) => ({
            name: l.name,
            proficiency: l.proficiency || 'Fluent',
          })),
          experience: (c.experience || []).map((w: any) => ({
            company: w.company || '',
            role: w.role || '',
            start_date: w.startDate || '',
            end_date: w.endDate || '',
            description: w.description || '',
            technologies: w.technologies || [],
            is_current: w.isCurrent || false,
          })),
          education: (c.education || []).map((e: any) => ({
            institution: e.institution || '',
            degree: e.degree || '',
            field_of_study: e.fieldOfStudy || '',
            start_year: e.startYear || 0,
            end_year: e.endYear || 0,
          })),
          certifications: (c.certifications || []).map((cert: any) => ({
            name: cert.name || '',
            issuer: cert.issuer || '',
            issue_date: cert.issueDate || '',
          })),
          projects: (c.projects || []).map((p: any) => ({
            name: p.name || '',
            description: p.description || '',
            technologies: p.technologies || [],
            role: p.role || '',
            link: p.link || '',
            start_date: p.startDate || '',
            end_date: p.endDate || '',
          })),
          availability: c.availability ? {
            status: c.availability.status || '',
            type: c.availability.type || '',
            start_date: c.availability.startDate || '',
          } : undefined,
          social_links: c.socialLinks ? {
            linkedin: c.socialLinks.linkedin || '',
            github: c.socialLinks.github || '',
            portfolio: c.socialLinks.portfolio || '',
          } : undefined,
          total_experience_years: c.totalExperienceYears || 0,
          current_title: c.currentTitle || '',
          current_company: c.currentCompany || '',
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
        headline: response.headline || '',
        bio: response.bio || '',
        location: response.location || '',
        skills: (response.skills || []).map((s: any) => ({
          name: s.name,
          level: s.level || 'Intermediate',
          yearsOfExperience: s.years_of_experience || 0,
        })),
        languages: (response.languages || []).map((l: any) => ({
          name: l.name,
          proficiency: l.proficiency || 'Fluent',
        })),
        experience: (response.experience || []).map((w: any) => ({
          company: w.company,
          role: w.role,
          startDate: w.start_date,
          endDate: w.end_date,
          description: w.description,
          technologies: w.technologies || [],
          isCurrent: w.is_current || false,
        })),
        education: (response.education || []).map((e: any) => ({
          institution: e.institution,
          degree: e.degree,
          fieldOfStudy: e.field_of_study,
          startYear: e.start_year,
          endYear: e.end_year,
        })),
        certifications: (response.certifications || []).map((c: any) => ({
          name: c.name,
          issuer: c.issuer,
          issueDate: c.issue_date,
        })),
        projects: (response.projects || []).map((p: any) => ({
          name: p.name,
          description: p.description,
          technologies: p.technologies || [],
          role: p.role,
          link: p.link,
          startDate: p.start_date,
          endDate: p.end_date,
        })),
        availability: response.availability ? {
          status: response.availability.status,
          type: response.availability.type,
          startDate: response.availability.start_date,
        } : null,
        socialLinks: response.social_links ? {
          linkedin: response.social_links.linkedin,
          github: response.social_links.github,
          portfolio: response.social_links.portfolio,
        } : null,
        phone: response.phone,
        totalExperienceYears: response.total_experience_years || 0,
        currentTitle: response.current_title,
        currentCompany: response.current_company,
      };
    } catch (error) {
      this.logger.warn(`gRPC ExtractResume exception: ${error.message}`);
      return null;
    }
  }
}
