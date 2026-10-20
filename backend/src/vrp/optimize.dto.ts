import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepotDto {
  @ApiProperty({ example: 116.4 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
  @ApiProperty({ example: 39.9 }) @IsNumber() @Min(-90) @Max(90) lat!: number;
}
export class OptimizeDto {
  @ApiProperty({ enum: ['CVRP-GA', 'VRPTW-GA', 'NSGA-II'], default: 'CVRP-GA' })
  @IsIn(['CVRP-GA', 'VRPTW-GA', 'NSGA-II'])
  algorithm: 'CVRP-GA' | 'VRPTW-GA' | 'NSGA-II' = 'CVRP-GA';
  @ApiProperty({
    default: 480,
    description: 'VRPTW 出发时间，午夜起的分钟数，480=08:00',
  })
  @IsNumber()
  @Min(0)
  @Max(1440)
  departureTime = 480;
  @ApiProperty({
    default: 30,
    description: 'VRPTW 估算车速 km/h，基于球面距离，无实时路况',
  })
  @IsNumber()
  @Min(1)
  @Max(120)
  speedKmh = 30;
  @ApiProperty({
    default: 1000,
    description: 'VRPTW 每迟到一分钟的等效米数惩罚，非金额',
  })
  @IsNumber()
  @Min(0)
  @Max(1000000)
  penaltyPerMinute = 1000;
  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  orderIds!: number[];
  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  vehicleIds!: number[];
  @ApiProperty({ type: DepotDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => DepotDto)
  depot!: DepotDto;
  @ApiProperty({ default: true }) @IsBoolean() returnToDepot = true;
  @ApiProperty({ default: 42, description: '固定随机种子便于复现实验' })
  @IsInt()
  @Min(0)
  @Max(4294967295)
  seed = 42;
}
