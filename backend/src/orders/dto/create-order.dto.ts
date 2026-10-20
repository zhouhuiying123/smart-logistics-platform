import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsEnum, IsOptional, Min, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 1, description: '客户 ID' })
  @IsInt()
  customerId: number;

  @ApiProperty({ example: 12.5, description: '重量（kg）' })
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiProperty({ example: 0.08, description: '体积（m³）' })
  @IsNumber()
  @Min(0)
  volume: number;

  @ApiPropertyOptional({ example: 1, description: '优先级，越大越优先', default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateOrderDto {
  @IsOptional() @IsInt() customerId?: number;
  @IsOptional() @IsNumber() @Min(0) weight?: number;
  @IsOptional() @IsNumber() @Min(0) volume?: number;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsInt() priority?: number;
}