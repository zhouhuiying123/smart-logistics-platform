import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: '张三', description: '客户姓名' })
  @IsString()
  name: string;

  @ApiProperty({ example: '13800138000', description: '联系电话' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '北京市海淀区中关村大街1号', description: '地址' })
  @IsString()
  address: string;

  @ApiProperty({ example: 116.326, description: '经度' })
  @IsNumber()
  lng: number;

  @ApiProperty({ example: 39.992, description: '纬度' })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 480, description: '时间窗开始（分钟，0=00:00）', minimum: 0, maximum: 1440 })
  @IsNumber()
  @Min(0) @Max(1440)
  timeWindowStart: number;

  @ApiProperty({ example: 600, description: '时间窗结束（分钟）', minimum: 0, maximum: 1440 })
  @IsNumber()
  @Min(0) @Max(1440)
  timeWindowEnd: number;

  @ApiPropertyOptional({ example: 15, description: '服务时长（分钟）', default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  serviceTime?: number;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) timeWindowStart?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) timeWindowEnd?: number;
  @IsOptional() @IsNumber() @Min(0) serviceTime?: number;
}