import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'recruiter@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Jean' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Habimana' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiPropertyOptional({ example: 'TechCorp Rwanda' })
  @IsOptional()
  @IsString()
  company?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'recruiter@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;
}
