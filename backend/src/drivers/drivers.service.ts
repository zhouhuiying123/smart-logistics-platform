import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/create-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDriverDto) {
    const exists = await this.prisma.driver.findUnique({ where: { license: dto.license } });
    if (exists) throw new ConflictException(`驾驶证号 ${dto.license} 已存在`);
    return this.prisma.driver.create({ data: dto });
  }

  async findAll() {
    return this.prisma.driver.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const d = await this.prisma.driver.findUnique({ where: { id } });
    if (!d) throw new NotFoundException(`司机 ${id} 不存在`);
    return d;
  }

  async update(id: number, dto: UpdateDriverDto) {
    await this.findOne(id);
    if (dto.license) {
      const dup = await this.prisma.driver.findUnique({ where: { license: dto.license } });
      if (dup && dup.id !== id) throw new ConflictException(`驾驶证号 ${dto.license} 已存在`);
    }
    return this.prisma.driver.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.driver.delete({ where: { id } });
  }
}
