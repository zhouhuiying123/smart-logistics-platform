import { Optional } from '@nestjs/common';
import { TrackingGateway } from '../tracking/tracking.gateway';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDispatchTaskDto } from './dto/create-dispatch-task.dto';
import { UpdateDispatchTaskDto } from './dto/update-dispatch-task.dto';
import {
  Prisma,
  TaskStatus,
  VehicleStatus,
  DriverStatus,
  OrderStatus,
} from '@prisma/client';

@Injectable()
export class DispatchTasksService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tracking?: TrackingGateway,
  ) {}

  async create(dto: CreateDispatchTaskDto) {
    // 校验车辆存在且当前空闲
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) throw new NotFoundException(`车辆 ${dto.vehicleId} 不存在`);
    if (vehicle.status !== VehicleStatus.IDLE) {
      throw new BadRequestException(
        `车辆 ${dto.vehicleId} 当前状态为 ${vehicle.status}，无法分配`,
      );
    }

    // 校验司机存在且当前可用
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver) throw new NotFoundException(`司机 ${dto.driverId} 不存在`);
    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new BadRequestException(
        `司机 ${dto.driverId} 当前状态为 ${driver.status}，无法分配`,
      );
    }

    // 创建任务并联动更新车辆/司机状态
    return this.prisma.dispatchTask.create({
      data: {
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        status: TaskStatus.CREATED,
      },
      include: { vehicle: true, driver: true },
    });
  }

  async findAll() {
    return this.prisma.dispatchTask.findMany({
      orderBy: { id: 'asc' },
      include: {
        vehicle: true,
        driver: true,
        stops: {
          orderBy: { seq: 'asc' },
          include: { order: { include: { customer: true } } },
        },
      },
    });
  }

  async findOne(id: number) {
    const t = await this.prisma.dispatchTask.findUnique({
      where: { id },
      include: {
        vehicle: true,
        driver: true,
        stops: {
          orderBy: { seq: 'asc' },
          include: { order: { include: { customer: true } } },
        },
      },
    });
    if (!t) throw new NotFoundException(`调度任务 ${id} 不存在`);
    return t;
  }

  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException('状态正在被其他请求修改，请刷新后重试');
      throw error;
    }
  }

  async update(id: number, dto: UpdateDispatchTaskDto) {
    if (dto.startTime !== undefined || dto.endTime !== undefined)
      throw new BadRequestException(
        '开始和结束时间由状态流转自动记录，请只提交 status',
      );
    const result = await this.transaction(async (tx) => {
      const task = await tx.dispatchTask.findUnique({
        where: { id },
        include: { stops: true },
      });
      if (!task) throw new NotFoundException(`调度任务 ${id} 不存在`);
      const next = dto.status;
      const allowed: Record<TaskStatus, TaskStatus[]> = {
        CREATED: ['ASSIGNED', 'CANCELLED'],
        ASSIGNED: ['STARTED', 'CANCELLED'],
        STARTED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
      };
      const data: Prisma.DispatchTaskUpdateInput = {};
      if (dto.totalDist !== undefined) data.totalDist = dto.totalDist;
      if (dto.totalCost !== undefined) data.totalCost = dto.totalCost;
      if (next && next !== task.status) {
        if (!allowed[task.status].includes(next))
          throw new BadRequestException(
            `非法状态流转：${task.status} → ${next}`,
          );
        const ids = [...new Set(task.stops.map((s) => s.orderId))];
        if (next === 'ASSIGNED') {
          if (!ids.length)
            throw new BadRequestException(
              '任务没有配送订单，请使用路线优化确认接口生成任务',
            );
          const v = await tx.vehicle.updateMany({
            where: { id: task.vehicleId, status: 'IDLE' },
            data: { status: 'ON_DUTY' },
          });
          const d = await tx.driver.updateMany({
            where: { id: task.driverId, status: 'AVAILABLE' },
            data: { status: 'ON_DUTY' },
          });
          if (v.count !== 1 || d.count !== 1)
            throw new ConflictException('车辆或司机已被占用');
        }
        if (
          ids.length &&
          !(task.status === 'CREATED' && next === 'CANCELLED')
        ) {
          const expected =
            task.status === 'CREATED'
              ? 'PENDING'
              : task.status === 'ASSIGNED'
                ? 'ASSIGNED'
                : 'IN_TRANSIT';
          const status: OrderStatus =
            next === 'ASSIGNED'
              ? 'ASSIGNED'
              : next === 'STARTED'
                ? 'IN_TRANSIT'
                : next === 'COMPLETED'
                  ? 'DELIVERED'
                  : 'PENDING';
          const changed = await tx.order.updateMany({
            where: { id: { in: ids }, status: expected },
            data: { status },
          });
          if (changed.count !== ids.length)
            throw new ConflictException('关联订单状态已变化，操作已撤销');
        }
        if (next === 'STARTED') data.startTime = new Date();
        if (next === 'COMPLETED' || next === 'CANCELLED') {
          data.endTime = new Date();
          if (task.status === 'ASSIGNED' || task.status === 'STARTED') {
            const other = await tx.dispatchTask.count({
              where: {
                id: { not: id },
                status: { in: ['ASSIGNED', 'STARTED'] },
                OR: [
                  { vehicleId: task.vehicleId },
                  { driverId: task.driverId },
                ],
              },
            });
            if (other)
              throw new ConflictException(
                '车辆或司机还关联其他活动任务，请先核查',
              );
            const v = await tx.vehicle.updateMany({
              where: { id: task.vehicleId, status: 'ON_DUTY' },
              data: { status: 'IDLE' },
            });
            const d = await tx.driver.updateMany({
              where: { id: task.driverId, status: 'ON_DUTY' },
              data: { status: 'AVAILABLE' },
            });
            if (v.count !== 1 || d.count !== 1)
              throw new ConflictException('车辆或司机状态异常，操作已撤销');
          }
          await tx.dispatchStop.updateMany({
            where: { taskId: id },
            data: { arrived: next === 'COMPLETED' },
          });
        }
        data.status = next;
      }
      return tx.dispatchTask.update({
        where: { id },
        data,
        include: {
          vehicle: true,
          driver: true,
          stops: {
            orderBy: { seq: 'asc' },
            include: { order: { include: { customer: true } } },
          },
        },
      });
    });
    this.tracking?.publish(result);
    return result;
  }

  async remove(id: number) {
    return this.transaction(async (tx) => {
      const task = await tx.dispatchTask.findUnique({ where: { id } });
      if (!task) throw new NotFoundException(`调度任务 ${id} 不存在`);
      if (task.status === 'ASSIGNED' || task.status === 'STARTED')
        throw new BadRequestException('活动任务请先取消，再删除');
      return tx.dispatchTask.delete({ where: { id } });
    });
  }
}
