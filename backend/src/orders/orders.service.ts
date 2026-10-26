import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer)
      throw new BadRequestException(`客户 ${dto.customerId} 不存在`);

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
    const current = await this.findOne(id);
    if (current.status !== 'PENDING')
      throw new ConflictException(
        '只有待分配订单可以编辑；配送状态请通过调度任务流转',
      );
    if (dto.customerId !== undefined) {
      const c = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!c) throw new BadRequestException(`客户 ${dto.customerId} 不存在`);
    }
    return this.prisma.order.update({
      where: { id },
      data: dto,
      include: { customer: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    const linkedStops = await this.prisma.dispatchStop.count({
      where: { orderId: id },
    });
    if (linkedStops)
      throw new ConflictException('该订单已有调度记录，不能删除');
    return this.prisma.order.delete({ where: { id } });
  }
}
