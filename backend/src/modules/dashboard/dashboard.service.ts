import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Job } from '../../common/schemas/job.schema';
import { Applicant } from '../../common/schemas/applicant.schema';
import { Screening } from '../../common/schemas/screening.schema';
import { ScreeningResult } from '../../common/schemas/screening-result.schema';
import { ScreeningStatus } from '../../common/enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<Job>,
    @InjectModel(Applicant.name) private applicantModel: Model<Applicant>,
    @InjectModel(Screening.name) private screeningModel: Model<Screening>,
    @InjectModel(ScreeningResult.name) private resultModel: Model<ScreeningResult>,
  ) {}

  async getOverview(recruiterId: string) {
    const uid = new Types.ObjectId(recruiterId);

    const [totalJobs, totalApplicants, totalScreenings, completedScreenings] = await Promise.all([
      this.jobModel.countDocuments({ recruiterId: uid }),
      this.applicantModel.countDocuments({
        jobId: { $in: await this.jobModel.find({ recruiterId: uid }).distinct('_id') },
      }),
      this.screeningModel.countDocuments({ recruiterId: uid }),
      this.screeningModel.countDocuments({ recruiterId: uid, status: ScreeningStatus.COMPLETED }),
    ]);

    const avgScoreResult = await this.screeningModel.aggregate([
      { $match: { recruiterId: uid, status: ScreeningStatus.COMPLETED } },
      { $group: { _id: null, avgScore: { $avg: '$averageMatchScore' } } },
    ]);
    const avgMatchScore = avgScoreResult[0]?.avgScore || 0;

    const recentScreenings = await this.screeningModel
      .find({ recruiterId: uid })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('jobId', 'title');

    const topCandidates = await this.resultModel
      .find({ jobId: { $in: await this.jobModel.find({ recruiterId: uid }).distinct('_id') } })
      .sort({ overallScore: -1 })
      .limit(5)
      .populate('applicantId', 'firstName lastName currentTitle')
      .populate('jobId', 'title');

    return {
      totalJobs,
      totalApplicants,
      totalScreenings,
      completedScreenings,
      avgMatchScore: Math.round(avgMatchScore),
      recentScreenings,
      topCandidates,
    };
  }
}
