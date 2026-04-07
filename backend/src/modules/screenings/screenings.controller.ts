import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './screenings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Screenings')
@ApiBearerAuth()
@Controller('screenings')
export class ScreeningsController {
  constructor(private readonly screeningsService: ScreeningsService) {}

  @Post()
  create(@Body() dto: CreateScreeningDto, @CurrentUser('sub') userId: string) {
    return this.screeningsService.create(dto, userId);
  }

  @Get()
  findAll(
    @Query('jobId') jobId?: string,
    @CurrentUser('sub') userId?: string,
  ) {
    return this.screeningsService.findAll(jobId, userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.screeningsService.findById(id);
  }

  @Get(':id/results')
  getResults(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.screeningsService.getResults(id, limit);
  }
}
