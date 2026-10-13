import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VrpPointDto {
  @ApiProperty({
    example: 'depot',
    description: '地点唯一编号',
  })
  @IsString()
  @Matches(/\S/, { message: 'id 不能为空或全部为空格' })
  id!: string;

  @ApiProperty({
    example: 116.4,
    description: 'WGS84 经度',
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({
    example: 39.9,
    description: 'WGS84 纬度',
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}

export class DistanceMatrixDto {
  @ApiProperty({
    type: [VrpPointDto],
    description: '按顺序传入仓库和配送点，最多 500 个',
    example: [
      { id: 'depot', lng: 116.4, lat: 39.9 },
      { id: 'customer-a', lng: 116.41, lat: 39.9 },
      { id: 'customer-b', lng: 116.4, lat: 39.91 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => VrpPointDto)
  points!: VrpPointDto[];
}