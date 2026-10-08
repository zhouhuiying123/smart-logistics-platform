import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateDispatchTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus, description: '任务状态' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: '开始时间' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: '总距离（km）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDist?: number;

  @ApiPropertyOptional({ description: '总成本（元）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;
}
