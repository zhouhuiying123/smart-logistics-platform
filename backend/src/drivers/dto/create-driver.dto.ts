import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength, Matches } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class CreateDriverDto {
  @ApiProperty({ example: '张三', description: '司机姓名' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '13800138000', description: '联系电话' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone: string;

  @ApiProperty({ example: '110101199001011234', description: '驾驶证号（唯一）' })
  @IsString()
  @MaxLength(30)
  license: string;
}

export class UpdateDriverDto {
  @IsOptional() @IsString() @MaxLength(50) name?: string;
  @IsOptional() @IsString() @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) license?: string;
  @IsOptional() @IsEnum(DriverStatus) status?: DriverStatus;
}
