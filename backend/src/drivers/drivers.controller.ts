import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/create-driver.dto';

@ApiTags('司机管理')
@Controller('drivers')
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Post()
  @ApiOperation({ summary: '创建司机（驾驶证号唯一）' })
  create(@Body() dto: CreateDriverDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询全部司机' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '查询单个司机' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新司机（可改状态）' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDriverDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除司机' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
