import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DriverAssignmentDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) vehicleId!: number;
  @ApiProperty({ example: 1 }) @IsInt() @Min(1) driverId!: number;
}
export class ConfirmDto {
  @ApiProperty({
    description:
      '本次 optimize 返回的 previewId，15 分钟内有效；重启后需重新计算',
  })
  @IsUUID()
  previewId!: string;
  @ApiProperty({ example: 'solution-1' }) @IsString() solutionId!: string;
  @ApiProperty({ type: [DriverAssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DriverAssignmentDto)
  assignments!: DriverAssignmentDto[];
}
