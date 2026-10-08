import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DispatchTasksService } from './dispatch-tasks.service';
import { CreateDispatchTaskDto } from './dto/create-dispatch-task.dto';
import { UpdateDispatchTaskDto } from './dto/update-dispatch-task.dto';

@ApiTags('调度任务')
@Controller('dispatch-tasks')
export class DispatchTasksController {
  constructor(private readonly service: DispatchTasksService) {}

  @Post()
  @ApiOperation({ summary: '创建调度任务（校验车辆/司机可用性）' })
  create(@Body() dto: CreateDispatchTaskDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询全部调度任务' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个调度任务（含车辆/司机/停靠点）' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新调度任务（状态流转联动车辆/司机/订单）' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDispatchTaskDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除调度任务（释放车辆/司机）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
