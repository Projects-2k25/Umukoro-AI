import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { Applicant } from '../../common/schemas/applicant.schema';
import { Job } from '../../common/schemas/job.schema';
import { ApplicantSource } from '../../common/enums';
import { ScreeningServiceClient } from '../../grpc/screening-service.client';

@Injectable()
export class ApplicantsService {
  private readonly logger = new Logger(ApplicantsService.name);

  constructor(
    @InjectModel(Applicant.name) private applicantModel: Model<Applicant>,
    @InjectModel(Job.name) private jobModel: Model<Job>,
    private configService: ConfigService,
    private readonly screeningClient: ScreeningServiceClient,
  ) {}

  async importProfiles(jobId: string, profiles: any[], recruiterId: string) {
    await this.validateJobOwnership(jobId, recruiterId);

    const applicants = profiles.map((profile) => ({
      jobId: new Types.ObjectId(jobId),
      source: ApplicantSource.UMURAVA_PROFILE,
      firstName: profile.firstName || profile.first_name || '',
      lastName: profile.lastName || profile.last_name || '',
      email: profile.email || '',
      headline: profile.headline || '',
      bio: profile.bio || '',
      location: profile.location || '',
      skills: (profile.skills || []).map((s: any) =>
        typeof s === 'string'
          ? { name: s, level: 'Intermediate', yearsOfExperience: 0 }
          : { name: s.name, level: s.level || 'Intermediate', yearsOfExperience: s.yearsOfExperience || 0 },
      ),
      languages: (profile.languages || []).map((l: any) =>
        typeof l === 'string'
          ? { name: l, proficiency: 'Fluent' }
          : { name: l.name, proficiency: l.proficiency || 'Fluent' },
      ),
      experience: (profile.experience || profile.workHistory || profile.work_history || []).map((w: any) => ({
        company: w.company || '',
        role: w.role || w.title || '',
        startDate: w.startDate || w['Start Date'] || '',
        endDate: w.endDate || w['End Date'] || '',
        description: w.description || '',
        technologies: w.technologies || [],
        isCurrent: w.isCurrent || w['Is Current'] || false,
      })),
      education: (profile.education || []).map((e: any) => ({
        institution: e.institution || '',
        degree: e.degree || '',
        fieldOfStudy: e.fieldOfStudy || e['Field of Study'] || e.field || '',
        startYear: e.startYear || e['Start Year'] || null,
        endYear: e.endYear || e['End Year'] || e.graduationYear || null,
      })),
      certifications: (profile.certifications || []).map((c: any) =>
        typeof c === 'string'
          ? { name: c, issuer: '', issueDate: '' }
          : { name: c.name || '', issuer: c.issuer || '', issueDate: c.issueDate || c['Issue Date'] || '' },
      ),
      projects: (profile.projects || []).map((p: any) => ({
        name: p.name || '',
        description: p.description || '',
        technologies: p.technologies || [],
        role: p.role || '',
        link: p.link || '',
        startDate: p.startDate || p['Start Date'] || '',
        endDate: p.endDate || p['End Date'] || '',
      })),
      availability: profile.availability
        ? {
            status: profile.availability.status || 'Available',
            type: profile.availability.type || 'Full-time',
            startDate: profile.availability.startDate || profile.availability['Start Date'] || '',
          }
        : { status: 'Available', type: 'Full-time', startDate: '' },
      socialLinks: profile.socialLinks
        ? {
            linkedin: profile.socialLinks.linkedin || '',
            github: profile.socialLinks.github || '',
            portfolio: profile.socialLinks.portfolio || '',
          }
        : {
            linkedin: profile.linkedinUrl || profile.linkedin_url || '',
            github: profile.githubUrl || profile.github_url || '',
            portfolio: profile.portfolioUrl || profile.portfolio_url || '',
          },
      phone: profile.phone || '',
      totalExperienceYears: profile.totalExperienceYears || profile.experience_years || 0,
      currentTitle: profile.currentTitle || profile.title || '',
      currentCompany: profile.currentCompany || profile.company || '',
      umuravaId: profile.id || profile.umuravaId || '',
      umuravaProfile: profile,
      rawData: profile,
    }));

    const results = await this.applicantModel.insertMany(applicants, { ordered: false });
    await this.jobModel.findByIdAndUpdate(jobId, { $inc: { totalApplicants: results.length } });

    return { imported: results.length, total: profiles.length };
  }

  async uploadFile(jobId: string, file: Express.Multer.File, recruiterId: string) {
    await this.validateJobOwnership(jobId, recruiterId);

    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      return this.parseSpreadsheet(jobId, file);
    }
    if (ext === 'pdf') {
      return this.parsePdf(jobId, file);
    }
    if (ext === 'json') {
      return this.parseJson(jobId, file, recruiterId);
    }

    throw new BadRequestException('Unsupported file type. Use CSV, XLSX, PDF, or JSON.');
  }

  private async parseJson(jobId: string, file: Express.Multer.File, recruiterId: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid JSON file');
    }

    const profiles = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.profiles)
        ? parsed.profiles
        : Array.isArray(parsed?.applicants)
          ? parsed.applicants
          : null;

    if (!profiles) {
      throw new BadRequestException(
        'JSON must be an array of profiles, or an object with a "profiles" or "applicants" array',
      );
    }
    if (profiles.length === 0) {
      throw new BadRequestException('No profiles found in JSON');
    }

    return this.importProfiles(jobId, profiles, recruiterId);
  }

  private async parseSpreadsheet(jobId: string, file: Express.Multer.File) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) throw new BadRequestException('Spreadsheet is empty');

    const headers = Object.keys(rows[0] || {});
    const headerMap = await this.resolveHeaderMapping(headers, rows[0] || {});

    const errors: { row: number; reason: string }[] = [];
    const applicants: any[] = [];

    rows.forEach((row, idx) => {
      const get = (canonical: string): string => {
        for (const [orig, target] of Object.entries(headerMap)) {
          if (target === canonical && row[orig] != null && row[orig] !== '') {
            return row[orig].toString().trim();
          }
        }
        return '';
      };

      let firstName = get('firstName');
      let lastName = get('lastName');
      const fullName = get('fullName');
      if ((!firstName || !lastName) && fullName) {
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (!firstName) firstName = parts[0] || '';
        if (!lastName) lastName = parts.slice(1).join(' ');
      }

      if (!firstName && !lastName) {
        errors.push({ row: idx + 2, reason: 'Missing name' });
        return;
      }

      const skills = get('skills')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, level: 'Intermediate', yearsOfExperience: 0 }));

      const educationStr = get('education');
      const experienceYears = parseInt(get('totalExperienceYears') || '0', 10) || 0;

      applicants.push({
        jobId: new Types.ObjectId(jobId),
        source: ApplicantSource.CSV_IMPORT,
        firstName,
        lastName,
        email: get('email').toLowerCase(),
        headline: get('headline'),
        bio: get('bio'),
        location: get('location'),
        skills,
        experience: [],
        education: educationStr
          ? [{ degree: "Bachelor's", fieldOfStudy: educationStr, institution: '' }]
          : [],
        certifications: [],
        projects: [],
        availability: { status: 'Available', type: 'Full-time', startDate: '' },
        socialLinks: {
          linkedin: get('linkedin'),
          github: get('github'),
          portfolio: get('portfolio'),
        },
        phone: get('phone'),
        totalExperienceYears: experienceYears,
        currentTitle: get('currentTitle'),
        currentCompany: get('currentCompany'),
        rawData: row,
      });
    });

    let imported = 0;
    if (applicants.length > 0) {
      const results = await this.applicantModel.insertMany(applicants, { ordered: false });
      imported = results.length;
      await this.jobModel.findByIdAndUpdate(jobId, { $inc: { totalApplicants: imported } });
    }

    return { imported, errors, total: rows.length };
  }

  private async resolveHeaderMapping(
    headers: string[],
    sampleRow: Record<string, any>,
  ): Promise<Record<string, string>> {
    const fallback = this.fallbackHeaderMapping(headers);

    try {
      const aiServiceUrl = this.configService.get<string>(
        'AI_SERVICE_URL',
        'http://localhost:8000',
      );
      const response = await axios.post(
        `${aiServiceUrl}/api/v1/map-headers`,
        { headers, sampleRow },
        { timeout: 15000 },
      );
      const mapping = response.data?.mapping || {};
      if (Object.keys(mapping).length === 0) return fallback;
      return { ...fallback, ...mapping };
    } catch (error: any) {
      this.logger.warn(
        `Header-mapping LLM unavailable, using fallback: ${error?.message || error}`,
      );
      return fallback;
    }
  }

  private fallbackHeaderMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const rules: Array<{ canonical: string; keys: string[] }> = [
      { canonical: 'firstName', keys: ['firstname', 'first', 'givenname'] },
      { canonical: 'lastName', keys: ['lastname', 'last', 'surname', 'familyname'] },
      { canonical: 'fullName', keys: ['fullname', 'name', 'candidatename', 'applicantname'] },
      { canonical: 'email', keys: ['email', 'emailaddress', 'mail'] },
      { canonical: 'phone', keys: ['phone', 'phonenumber', 'mobile', 'tel'] },
      { canonical: 'headline', keys: ['headline', 'title', 'jobtitle'] },
      { canonical: 'bio', keys: ['bio', 'about', 'summary'] },
      { canonical: 'location', keys: ['location', 'city', 'country', 'address'] },
      { canonical: 'skills', keys: ['skills', 'skillset', 'expertise', 'technologies'] },
      { canonical: 'totalExperienceYears', keys: ['experience', 'experienceyears', 'yearsofexperience', 'yearsexperience', 'yoe'] },
      { canonical: 'currentTitle', keys: ['currenttitle', 'position', 'currentposition', 'role'] },
      { canonical: 'currentCompany', keys: ['currentcompany', 'company', 'employer'] },
      { canonical: 'education', keys: ['education', 'degree', 'qualification'] },
      { canonical: 'linkedin', keys: ['linkedin', 'linkedinurl'] },
      { canonical: 'github', keys: ['github', 'githuburl'] },
      { canonical: 'portfolio', keys: ['portfolio', 'website', 'portfoliourl'] },
    ];

    for (const header of headers) {
      const n = norm(header);
      for (const { canonical, keys } of rules) {
        if (mapping[header]) break;
        if (keys.some((k) => n === k)) {
          mapping[header] = canonical;
          break;
        }
      }
    }
    return mapping;
  }

  private async parsePdf(jobId: string, file: Express.Multer.File) {
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(file.buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length < 50) {
      throw new BadRequestException('Could not extract meaningful text from PDF');
    }

    let extractedProfile: any = {};

    // Try gRPC first, fall back to HTTP
    try {
      const grpcResult = await this.screeningClient.extractResume(resumeText);
      if (grpcResult) {
        this.logger.log('Resume extracted via gRPC');
        extractedProfile = grpcResult;
      } else {
        throw new Error('gRPC unavailable');
      }
    } catch {
      // HTTP fallback
      try {
        const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
        const response = await axios.post(`${aiServiceUrl}/api/v1/extract-resume`, { resumeText });
        extractedProfile = response.data;
        this.logger.log('Resume extracted via HTTP fallback');
      } catch {
        extractedProfile = { firstName: 'Unknown', lastName: 'Candidate' };
      }
    }

    const applicant = await this.applicantModel.create({
      jobId: new Types.ObjectId(jobId),
      source: ApplicantSource.PDF_UPLOAD,
      firstName: extractedProfile.firstName || 'Unknown',
      lastName: extractedProfile.lastName || 'Candidate',
      email: extractedProfile.email || '',
      headline: extractedProfile.headline || '',
      bio: extractedProfile.bio || '',
      location: extractedProfile.location || '',
      skills: (extractedProfile.skills || []).map((s: any) => ({
        name: s.name || s,
        level: s.level || 'Intermediate',
        yearsOfExperience: s.yearsOfExperience || 0,
      })),
      languages: extractedProfile.languages || [],
      experience: (extractedProfile.experience || extractedProfile.workHistory || []).map((w: any) => ({
        company: w.company || '',
        role: w.role || w.title || '',
        startDate: w.startDate || '',
        endDate: w.endDate || '',
        description: w.description || '',
        technologies: w.technologies || [],
        isCurrent: w.isCurrent || false,
      })),
      education: (extractedProfile.education || []).map((e: any) => ({
        institution: e.institution || '',
        degree: e.degree || '',
        fieldOfStudy: e.fieldOfStudy || e.field || '',
        startYear: e.startYear || null,
        endYear: e.endYear || e.graduationYear || null,
      })),
      certifications: (extractedProfile.certifications || []).map((c: any) =>
        typeof c === 'string'
          ? { name: c, issuer: '', issueDate: '' }
          : { name: c.name || '', issuer: c.issuer || '', issueDate: c.issueDate || '' },
      ),
      projects: extractedProfile.projects || [],
      availability: extractedProfile.availability || { status: 'Available', type: 'Full-time', startDate: '' },
      socialLinks: extractedProfile.socialLinks || { linkedin: '', github: '', portfolio: '' },
      phone: extractedProfile.phone || '',
      totalExperienceYears: extractedProfile.totalExperienceYears || 0,
      currentTitle: extractedProfile.currentTitle || '',
      currentCompany: extractedProfile.currentCompany || '',
      resumeText,
      rawData: extractedProfile,
    });

    await this.jobModel.findByIdAndUpdate(jobId, { $inc: { totalApplicants: 1 } });

    return { imported: 1, applicant };
  }

  async findAll(jobId: string, page = 1, limit = 20) {
    const filter: any = {};
    if (jobId) filter.jobId = new Types.ObjectId(jobId);

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.applicantModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.applicantModel.countDocuments(filter),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const applicant = await this.applicantModel.findById(id);
    if (!applicant) throw new NotFoundException('Applicant not found');
    return applicant;
  }

  async delete(id: string) {
    const applicant = await this.applicantModel.findByIdAndDelete(id);
    if (!applicant) throw new NotFoundException('Applicant not found');
    await this.jobModel.findByIdAndUpdate(applicant.jobId, { $inc: { totalApplicants: -1 } });
    return { success: true };
  }

  async findByJobId(jobId: string) {
    return this.applicantModel.find({ jobId: new Types.ObjectId(jobId) });
  }

  private async validateJobOwnership(jobId: string, recruiterId: string) {
    const job = await this.jobModel.findOne({
      _id: jobId,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
