import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, JobQueryDto } from './jobs.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser('sub') userId: string) {
    return this.jobsService.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: JobQueryDto, @CurrentUser('sub') userId: string) {
    return this.jobsService.findAll(query, userId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.jobsService.findById(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.jobsService.update(id, dto, userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.jobsService.delete(id, userId);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.jobsService.getStats(id, userId);
  }
}
