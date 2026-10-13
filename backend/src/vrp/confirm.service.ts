import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmDto } from './confirm.dto';
import { fingerprint, PreviewStore } from './preview-store';

@Injectable()
export class ConfirmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly previews: PreviewStore,
  ) {}
  async confirm(dto: ConfirmDto) {
    const preview = this.previews.acquire(dto.previewId);
    try {
      const solution = preview.solutions.find(
        (s) => s.solutionId === dto.solutionId,
      );
      if (!solution) throw new BadRequestException('方案编号不属于本次预览');
      const drivers = new Set(dto.assignments.map((a) => a.driverId));
      const vehicles = new Set(dto.assignments.map((a) => a.vehicleId));
      if (
        drivers.size !== dto.assignments.length ||
        vehicles.size !== dto.assignments.length ||
        vehicles.size !== solution.routes.length ||
        solution.routes.some((r) => !vehicles.has(r.vehicleId))
      )
        throw new BadRequestException(
          '每条路线必须绑定一个不同的司机，车辆必须与所选方案一致',
        );
      const tasks = await this.prisma.$transaction(
        async (tx) => {
          const orders = await tx.order.findMany({
            where: { id: { in: preview.orderIds } },
            include: { customer: true },
          });
          const fleet = await tx.vehicle.findMany({
            where: { id: { in: preview.vehicleIds } },
          });
          if (fingerprint(orders, fleet) !== preview.fingerprint)
            throw new ConflictException('订单或车辆已变化，请重新优化');
          const available = await tx.driver.findMany({
            where: { id: { in: [...drivers] }, status: 'AVAILABLE' },
          });
          if (available.length !== drivers.size)
            throw new ConflictException('司机不存在或已被占用');
          // Conditional writes also protect against another preview claiming the same resources.
          const claimedOrders = await tx.order.updateMany({
            where: { id: { in: preview.orderIds }, status: 'PENDING' },
            data: { status: 'ASSIGNED' },
          });
          const claimedVehicles = await tx.vehicle.updateMany({
            where: { id: { in: [...vehicles] }, status: 'IDLE' },
            data: { status: 'ON_DUTY' },
          });
          const claimedDrivers = await tx.driver.updateMany({
            where: { id: { in: [...drivers] }, status: 'AVAILABLE' },
            data: { status: 'ON_DUTY' },
          });
          if (
            claimedOrders.count !== preview.orderIds.length ||
            claimedVehicles.count !== vehicles.size ||
            claimedDrivers.count !== drivers.size
          )
            throw new ConflictException('资源已被其他任务占用，请重新优化');
          const created = [];
          for (const route of solution.routes)
            created.push(
              await tx.dispatchTask.create({
                data: {
                  vehicleId: route.vehicleId,
                  driverId: dto.assignments.find(
                    (a) => a.vehicleId === route.vehicleId,
                  )!.driverId,
                  status: 'ASSIGNED',
                  totalDist: route.totalDistance,
                  stops: {
                    create: route.stops.map((s) => ({
                      orderId: s.orderId,
                      seq: s.seq,
                      lng: s.lng,
                      lat: s.lat,
                    })),
                  },
                },
                include: { stops: { orderBy: { seq: 'asc' } } },
              }),
            );
          return created;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        },
      );
      preview.consumed = true;
      return {
        previewId: dto.previewId,
        solutionId: dto.solutionId,
        tasks,
        message: '任务已生成，订单已分配，车辆和司机已占用',
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException('并发分配冲突，请重新优化');
      throw error;
    } finally {
      preview.busy = false;
    }
  }
}
