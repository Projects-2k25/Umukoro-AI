import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ApplicantsService } from './applicants.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Applicants')
@ApiBearerAuth()
@Controller('applicants')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post('import/:jobId')
  importProfiles(
    @Param('jobId') jobId: string,
    @Body() body: { profiles: any[] },
    @CurrentUser('sub') userId: string,
  ) {
    return this.applicantsService.importProfiles(jobId, body.profiles, userId);
  }

  @Post('upload/:jobId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  uploadFile(
    @Param('jobId') jobId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser('sub') userId: string,
  ) {
    return this.applicantsService.uploadFile(jobId, file, userId);
  }

  @Get()
  findAll(
    @Query('jobId') jobId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.applicantsService.findAll(jobId, page, limit);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.applicantsService.findById(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.applicantsService.delete(id);
  }
}
