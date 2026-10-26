import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VrpService } from './vrp.service';
import { OptimizeDto } from './optimize.dto';
import { DistanceMatrixDto } from './distance-matrix.dto';
import { ConfirmDto } from './confirm.dto';
import { ConfirmService } from './confirm.service';

@ApiTags('路径优化')
@Controller('vrp')
export class VrpController {
  constructor(
    private readonly vrp: VrpService,
    private readonly confirmation: ConfirmService,
  ) {}

  @Post('confirm')
  @ApiOperation({
    summary: '确认方案并生成调度任务',
    description:
      '提交 previewId、solutionId 和每辆车的司机。原子创建 ASSIGNED 任务及停靠点，占用订单/车辆/司机。重复提交或资源变化返回409；预览15分钟有效，重启后需重新计算。',
  })
  confirm(@Body() dto: ConfirmDto) {
    return this.confirmation.confirm(dto);
  }

  @Post('distance-matrix')
  @HttpCode(200)
  @ApiOperation({
    summary: '计算距离矩阵',
    description: '返回各地点之间的球面距离，单位为米，非道路行驶距离。',
  })
  calculateDistanceMatrix(@Body() dto: DistanceMatrixDto) {
    return this.vrp.distanceMatrix(dto.points);
  }

  @Post('optimize')
  @HttpCode(200)
  @ApiOperation({
    summary: 'CVRP-GA / VRPTW-GA / NSGA-II 路线优化预览',
    description:
      '输入待配送订单与空闲车辆编号，返回路线预览（**不产生任何数据变更**）。\n\n' +
      '- **CVRP-GA**：以总距离为目标优化\n' +
      '- **VRPTW-GA**：带时间窗，晚于时间窗结束受惩罚、提前到达等待、每单计服务时长\n' +
      '- **NSGA-II**：多目标优化，返回 Pareto 方案集\n\n' +
      '`status = FOUND` 表示容量完全可行；时间为午夜起分钟数（可超过 1440）；距离为球面距离；totalCost 为惩罚值而非金额。\n\n' +
      '确认方案请调用 `POST /vrp/confirm`（预览 15 分钟内有效）。',
  })
  optimize(@Body() dto: OptimizeDto) {
    return this.vrp.optimize(dto);
  }
}
