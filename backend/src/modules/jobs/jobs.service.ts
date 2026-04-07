import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job } from '../../common/schemas/job.schema';
import { Applicant } from '../../common/schemas/applicant.schema';
import { Screening } from '../../common/schemas/screening.schema';
import { CreateJobDto, UpdateJobDto, JobQueryDto } from './jobs.dto';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(Applicant.name) private applicantModel: Model<Applicant>,
    @InjectModel(Screening.name) private screeningModel: Model<Screening>,
  ) {}

  async create(dto: CreateJobDto, recruiterId: string) {
    const job = await this.jobModel.create({
      ...dto,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    return job;
  }

  async findAll(query: JobQueryDto, recruiterId: string) {
    const filter: any = { recruiterId: new Types.ObjectId(recruiterId) };
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.title = { $regex: query.search, $options: 'i' };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.jobModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.jobModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, recruiterId: string) {
    const job = await this.jobModel.findOne({
      _id: id,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    if (!job) throw new NotFoundException('Job not found');

    const applicantCount = await this.applicantModel.countDocuments({ jobId: job._id });
    const latestScreening = await this.screeningModel
      .findOne({ jobId: job._id })
      .sort({ createdAt: -1 });

    return { job, applicantCount, latestScreening };
  }

  async update(id: string, dto: UpdateJobDto, recruiterId: string) {
    const job = await this.jobModel.findOneAndUpdate(
      { _id: id, recruiterId: new Types.ObjectId(recruiterId) },
      { $set: dto },
      { new: true },
    );
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async delete(id: string, recruiterId: string) {
    const job = await this.jobModel.findOneAndDelete({
      _id: id,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    if (!job) throw new NotFoundException('Job not found');
    return { success: true };
  }

  async getStats(id: string, recruiterId: string) {
    const job = await this.jobModel.findOne({
      _id: id,
      recruiterId: new Types.ObjectId(recruiterId),
    });
    if (!job) throw new NotFoundException('Job not found');

    const totalApplicants = await this.applicantModel.countDocuments({ jobId: job._id });
    const screenings = await this.screeningModel.countDocuments({ jobId: job._id });

    return { totalApplicants, screenings, jobId: id };
  }
}
