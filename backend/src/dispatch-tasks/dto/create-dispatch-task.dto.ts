import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreateDispatchTaskDto {
  @ApiProperty({ example: 1, description: '车辆 ID' })
  @IsInt()
  @Min(1)
  vehicleId: number;

  @ApiProperty({ example: 1, description: '司机 ID' })
  @IsInt()
  @Min(1)
  driverId: number;
}
