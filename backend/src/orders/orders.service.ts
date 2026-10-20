import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new BadRequestException(`客户 ${dto.customerId} 不存在`);

    return this.prisma.order.create({
      data: { ...dto, priority: dto.priority ?? 0 },
      include: { customer: true },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { id: 'asc' },
      include: { customer: true },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException(`订单 ${id} 不存在`);
    return order;
  }

  async update(id: number, dto: UpdateOrderDto) {
    await this.findOne(id);
    if (dto.customerId !== undefined) {
      const c = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!c) throw new BadRequestException(`客户 ${dto.customerId} 不存在`);
    }
    return this.prisma.order.update({ where: { id }, data: dto, include: { customer: true } });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.order.delete({ where: { id } });
  }
}