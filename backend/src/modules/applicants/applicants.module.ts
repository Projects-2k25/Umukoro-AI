import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsService } from './applicants.service';
import { Applicant, ApplicantSchema } from '../../common/schemas/applicant.schema';
import { Job, JobSchema } from '../../common/schemas/job.schema';
import { GrpcModule } from '../../grpc/grpc.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Applicant.name, schema: ApplicantSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    GrpcModule,
  ],
  controllers: [ApplicantsController],
  providers: [ApplicantsService],
  exports: [ApplicantsService],
})
export class ApplicantsModule {}
