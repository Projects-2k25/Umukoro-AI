import { Controller, Get, Post, Body, Param, Query, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScreeningsService } from './screenings.service';
import { CreateScreeningDto } from './screenings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Screenings')
@ApiBearerAuth()
@Controller('screenings')
export class ScreeningsController {
  private readonly logger = new Logger(ScreeningsController.name);

  constructor(
    private readonly screeningsService: ScreeningsService,
    private readonly configService: ConfigService,
  ) {}

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

  @Public()
  @Post(':id/progress')
  async updateProgress(
    @Param('id') id: string,
    @Headers('x-internal-secret') providedSecret: string,
    @Body() body: { batchesDone: number; batchesTotal: number; candidatesDone: number },
  ) {
    const expected = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    if (!expected || providedSecret !== expected) {
      this.logger.warn(
        `Progress rejected for ${id}: expectedSet=${!!expected} providedSet=${!!providedSecret} match=${providedSecret === expected}`,
      );
      throw new UnauthorizedException('Invalid internal secret');
    }
    this.logger.log(
      `Progress ${id}: batches=${body.batchesDone}/${body.batchesTotal} candidates=${body.candidatesDone}`,
    );
    await this.screeningsService.updateProgress(
      id,
      Number(body.batchesDone) || 0,
      Number(body.batchesTotal) || 0,
      Number(body.candidatesDone) || 0,
    );
    return { ok: true };
  }
}
