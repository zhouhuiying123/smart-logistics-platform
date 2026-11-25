import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVehicleDto) {
    const exists = await this.prisma.vehicle.findUnique({
      where: { plate: dto.plate },
    });
    if (exists) throw new ConflictException(`车牌 ${dto.plate} 已存在`);
    return this.prisma.vehicle.create({ data: dto });
  }

  async findAll() {
    return this.prisma.vehicle.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const v = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`车辆 ${id} 不存在`);
    return v;
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const current = await this.findOne(id);
    if (current.status === 'ON_DUTY')
      throw new BadRequestException('执行任务中的车辆不能修改');
    if (dto.status === 'ON_DUTY')
      throw new BadRequestException('车辆状态由调度任务自动管理');
    if (dto.status !== undefined) {
      const activeTasks = await this.prisma.dispatchTask.count({
        where: { vehicleId: id, status: { in: ['ASSIGNED', 'STARTED'] } },
      });
      if (activeTasks)
        throw new ConflictException('车辆仍关联活动任务，不能修改状态');
    }
    if (dto.plate) {
      const dup = await this.prisma.vehicle.findUnique({
        where: { plate: dto.plate },
      });
      if (dup && dup.id !== id)
        throw new ConflictException(`车牌 ${dto.plate} 已存在`);
    }
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    const linkedTasks = await this.prisma.dispatchTask.count({
      where: { vehicleId: id },
    });
    if (linkedTasks)
      throw new ConflictException('该车辆已有调度记录，不能删除');
    return this.prisma.vehicle.delete({ where: { id } });
  }
}
