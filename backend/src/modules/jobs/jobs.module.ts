import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { Job, JobSchema } from '../../common/schemas/job.schema';
import { Applicant, ApplicantSchema } from '../../common/schemas/applicant.schema';
import { Screening, ScreeningSchema } from '../../common/schemas/screening.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Job.name, schema: JobSchema },
      { name: Applicant.name, schema: ApplicantSchema },
      { name: Screening.name, schema: ScreeningSchema },
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
