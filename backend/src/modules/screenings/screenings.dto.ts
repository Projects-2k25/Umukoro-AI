import { IsString, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScreeningWeightsDto {
  @ApiPropertyOptional({ default: 0.3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  skills?: number = 0.3;

  @ApiPropertyOptional({ default: 0.25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  experience?: number = 0.25;

  @ApiPropertyOptional({ default: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  education?: number = 0.2;

  @ApiPropertyOptional({ default: 0.25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  relevance?: number = 0.25;
}

export class ScreeningConfigDto {
  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(50)
  shortlistSize?: number = 10;

  @ApiPropertyOptional({ type: ScreeningWeightsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScreeningWeightsDto)
  weights?: ScreeningWeightsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customInstructions?: string;
}

export class CreateScreeningDto {
  @ApiProperty()
  @IsString()
  jobId: string;

  @ApiPropertyOptional({ type: ScreeningConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScreeningConfigDto)
  config?: ScreeningConfigDto;
}
