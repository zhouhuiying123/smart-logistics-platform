import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVehicleDto) {
    const exists = await this.prisma.vehicle.findUnique({ where: { plate: dto.plate } });
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
    await this.findOne(id);
    if (dto.plate) {
      const dup = await this.prisma.vehicle.findUnique({ where: { plate: dto.plate } });
      if (dup && dup.id !== id) throw new ConflictException(`车牌 ${dto.plate} 已存在`);
    }
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.vehicle.delete({ where: { id } });
  }
}