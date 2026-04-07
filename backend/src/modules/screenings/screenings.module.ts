import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScreeningsController } from './screenings.controller';
import { ScreeningsService } from './screenings.service';
import { Screening, ScreeningSchema } from '../../common/schemas/screening.schema';
import { ScreeningResult, ScreeningResultSchema } from '../../common/schemas/screening-result.schema';
import { Job, JobSchema } from '../../common/schemas/job.schema';
import { Applicant, ApplicantSchema } from '../../common/schemas/applicant.schema';
import { GrpcModule } from '../../grpc/grpc.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Screening.name, schema: ScreeningSchema },
      { name: ScreeningResult.name, schema: ScreeningResultSchema },
      { name: Job.name, schema: JobSchema },
      { name: Applicant.name, schema: ApplicantSchema },
    ]),
    GrpcModule,
  ],
  controllers: [ScreeningsController],
  providers: [ScreeningsService],
})
export class ScreeningsModule {}
