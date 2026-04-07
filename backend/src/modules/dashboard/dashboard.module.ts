import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Job, JobSchema } from '../../common/schemas/job.schema';
import { Applicant, ApplicantSchema } from '../../common/schemas/applicant.schema';
import { Screening, ScreeningSchema } from '../../common/schemas/screening.schema';
import { ScreeningResult, ScreeningResultSchema } from '../../common/schemas/screening-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Applicant.name, schema: ApplicantSchema },
      { name: Screening.name, schema: ScreeningSchema },
      { name: ScreeningResult.name, schema: ScreeningResultSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
