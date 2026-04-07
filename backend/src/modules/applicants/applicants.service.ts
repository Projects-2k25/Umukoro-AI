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
      phone: profile.phone || '',
      skills: (profile.skills || []).map((s: any) =>
        typeof s === 'string' ? { name: s, yearsOfExperience: 0 } : s,
      ),
      totalExperienceYears: profile.totalExperienceYears || profile.experience_years || 0,
      currentTitle: profile.currentTitle || profile.title || '',
      currentCompany: profile.currentCompany || profile.company || '',
      workHistory: profile.workHistory || profile.work_history || [],
      education: profile.education || [],
      certifications: profile.certifications || [],
      portfolioUrl: profile.portfolioUrl || profile.portfolio_url || '',
      linkedinUrl: profile.linkedinUrl || profile.linkedin_url || '',
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

    throw new BadRequestException('Unsupported file type. Use CSV, XLSX, or PDF.');
  }

  private async parseSpreadsheet(jobId: string, file: Express.Multer.File) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) throw new BadRequestException('Spreadsheet is empty');

    const errors: { row: number; reason: string }[] = [];
    const applicants: any[] = [];

    rows.forEach((row, idx) => {
      const firstName = row.firstName || row.first_name || row.FirstName || row['First Name'] || '';
      const lastName = row.lastName || row.last_name || row.LastName || row['Last Name'] || '';

      if (!firstName && !lastName) {
        errors.push({ row: idx + 2, reason: 'Missing name' });
        return;
      }

      const skills = (row.skills || row.Skills || '')
        .toString()
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((name: string) => ({ name, yearsOfExperience: 0 }));

      applicants.push({
        jobId: new Types.ObjectId(jobId),
        source: ApplicantSource.CSV_IMPORT,
        firstName: firstName.toString().trim(),
        lastName: lastName.toString().trim(),
        email: (row.email || row.Email || '').toString().trim(),
        phone: (row.phone || row.Phone || '').toString().trim(),
        skills,
        totalExperienceYears: parseInt(row.experience || row.Experience || row.experience_years || '0', 10) || 0,
        currentTitle: (row.title || row.Title || row.currentTitle || '').toString().trim(),
        currentCompany: (row.company || row.Company || row.currentCompany || '').toString().trim(),
        education: row.education || row.Education
          ? [{ degree: 'BACHELORS' as const, field: (row.education || row.Education || '').toString(), institution: '' }]
          : [],
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
      phone: extractedProfile.phone || '',
      skills: extractedProfile.skills || [],
      totalExperienceYears: extractedProfile.totalExperienceYears || 0,
      currentTitle: extractedProfile.currentTitle || '',
      currentCompany: extractedProfile.currentCompany || '',
      workHistory: extractedProfile.workHistory || [],
      education: extractedProfile.education || [],
      certifications: extractedProfile.certifications || [],
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
