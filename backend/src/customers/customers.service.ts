import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    if (dto.timeWindowStart >= dto.timeWindowEnd) {
      throw new BadRequestException('timeWindowStart 必须小于 timeWindowEnd');
    }
    return this.prisma.customer.create({
      data: { ...dto, serviceTime: dto.serviceTime ?? 0 },
    });
  }

  async findAll() {
    return this.prisma.customer.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`客户 ${id} 不存在`);
    return customer;
  }

  async update(id: number, dto: UpdateCustomerDto) {
    const current = await this.findOne(id);
    const start = dto.timeWindowStart ?? current.timeWindowStart;
    const end = dto.timeWindowEnd ?? current.timeWindowEnd;
    if (start >= end)
      throw new BadRequestException('timeWindowStart 必须小于 timeWindowEnd');
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    const linkedOrders = await this.prisma.order.count({
      where: { customerId: id },
    });
    if (linkedOrders)
      throw new ConflictException('该客户仍有关联订单，不能删除');
    return this.prisma.customer.delete({ where: { id } });
  }
}
