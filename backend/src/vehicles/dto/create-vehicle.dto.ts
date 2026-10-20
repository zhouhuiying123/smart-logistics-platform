import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, MaxLength } from 'class-validator';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: '京A12345', description: '车牌号' })
  @IsString()
  @MaxLength(20)
  plate: string;

  @ApiProperty({ example: 1000, description: '载重能力（kg）' })
  @IsNumber()
  @Min(0)
  capacityW: number;

  @ApiProperty({ example: 6, description: '载容能力（m³）' })
  @IsNumber()
  @Min(0)
  capacityV: number;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() @MaxLength(20) plate?: string;
  @IsOptional() @IsNumber() @Min(0) capacityW?: number;
  @IsOptional() @IsNumber() @Min(0) capacityV?: number;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
}