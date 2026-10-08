import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDispatchTaskDto } from './dto/create-dispatch-task.dto';
import { UpdateDispatchTaskDto } from './dto/update-dispatch-task.dto';
import { TaskStatus, VehicleStatus, DriverStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class DispatchTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDispatchTaskDto) {
    // 校验车辆存在且当前空闲
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw new NotFoundException(`车辆 ${dto.vehicleId} 不存在`);
    if (vehicle.status !== VehicleStatus.IDLE) {
      throw new BadRequestException(`车辆 ${dto.vehicleId} 当前状态为 ${vehicle.status}，无法分配`);
    }

    // 校验司机存在且当前可用
    const driver = await this.prisma.driver.findUnique({ where: { id: dto.driverId } });
    if (!driver) throw new NotFoundException(`司机 ${dto.driverId} 不存在`);
    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new BadRequestException(`司机 ${dto.driverId} 当前状态为 ${driver.status}，无法分配`);
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
      include: { vehicle: true, driver: true },
    });
  }

  async findOne(id: number) {
    const t = await this.prisma.dispatchTask.findUnique({
      where: { id },
      include: { vehicle: true, driver: true, stops: { include: { order: true } } },
    });
    if (!t) throw new NotFoundException(`调度任务 ${id} 不存在`);
    return t;
  }

  async update(id: number, dto: UpdateDispatchTaskDto) {
    const task = await this.findOne(id);

    // 状态流转联动逻辑
    if (dto.status) {
      await this.handleStatusTransition(task, dto.status);
    }

    const data: any = { ...dto };
    if (dto.startTime) data.startTime = new Date(dto.startTime);
    if (dto.endTime) data.endTime = new Date(dto.endTime);

    return this.prisma.dispatchTask.update({
      where: { id },
      data,
      include: { vehicle: true, driver: true, stops: { include: { order: true } } },
    });
  }

  async remove(id: number) {
    const task = await this.findOne(id);
    // 删除前释放车辆/司机
    if (task.status === TaskStatus.ASSIGNED || task.status === TaskStatus.STARTED) {
      await this.prisma.vehicle.update({
        where: { id: task.vehicleId },
        data: { status: VehicleStatus.IDLE },
      });
      await this.prisma.driver.update({
        where: { id: task.driverId },
        data: { status: DriverStatus.AVAILABLE },
      });
    }
    return this.prisma.dispatchTask.delete({ where: { id } });
  }

  /**
   * 状态流转联动：根据新状态更新关联的 vehicle/driver/order 状态
   * 流转图：CREATED → ASSIGNED → STARTED → COMPLETED/CANCELLED
   */
  private async handleStatusTransition(task: any, newStatus: TaskStatus) {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.CREATED]: [TaskStatus.ASSIGNED, TaskStatus.CANCELLED],
      [TaskStatus.ASSIGNED]: [TaskStatus.STARTED, TaskStatus.CANCELLED],
      [TaskStatus.STARTED]: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[task.status as TaskStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `非法状态流转：${task.status} → ${newStatus}（允许：${allowed.join('/') || '无'}）`,
      );
    }

    // ASSIGNED：占用车辆和司机
    if (newStatus === TaskStatus.ASSIGNED) {
      await this.prisma.vehicle.update({
        where: { id: task.vehicleId },
        data: { status: VehicleStatus.ON_DUTY },
      });
      await this.prisma.driver.update({
        where: { id: task.driverId },
        data: { status: DriverStatus.ON_DUTY },
      });
    }

    // COMPLETED 或 CANCELLED：释放车辆和司机
    if (newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELLED) {
      await this.prisma.vehicle.update({
        where: { id: task.vehicleId },
        data: { status: VehicleStatus.IDLE },
      });
      await this.prisma.driver.update({
        where: { id: task.driverId },
        data: { status: DriverStatus.AVAILABLE },
      });
      // 同步更新关联订单状态
      const stops = await this.prisma.dispatchStop.findMany({
        where: { taskId: task.id },
        select: { orderId: true },
      });
      const orderStatus = newStatus === TaskStatus.COMPLETED
        ? OrderStatus.DELIVERED
        : OrderStatus.FAILED;
      for (const s of stops) {
        await this.prisma.order.update({
          where: { id: s.orderId },
          data: { status: orderStatus },
        });
      }
    }
  }
}
