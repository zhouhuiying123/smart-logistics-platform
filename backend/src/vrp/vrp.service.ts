import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDistanceMatrix } from './distance-matrix';
import { VrpPoint } from './vrp.types';
import { OptimizeDto } from './optimize.dto';
import { solveCvrp, CvrpInput } from './cvrp';
import { solveNsga2 } from './nsga2';
import { PreviewStore } from './preview-store';

@Injectable()
export class VrpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly previews: PreviewStore,
  ) {}
  distanceMatrix(points: VrpPoint[]) {
    return buildDistanceMatrix(this.prisma, points);
  }
  async optimize(dto: OptimizeDto) {
    const [foundOrders, foundVehicles] = await Promise.all([
      this.prisma.order.findMany({
        where: { id: { in: dto.orderIds } },
        include: { customer: true },
      }),
      this.prisma.vehicle.findMany({ where: { id: { in: dto.vehicleIds } } }),
    ]);
    if (
      foundOrders.length !== dto.orderIds.length ||
      foundVehicles.length !== dto.vehicleIds.length
    )
      throw new BadRequestException('部分订单或车辆不存在');
    if (
      foundOrders.some((o) => o.status !== 'PENDING') ||
      foundVehicles.some((v) => v.status !== 'IDLE')
    )
      throw new BadRequestException('仅可选择 PENDING 订单和 IDLE 车辆');
    if (
      foundOrders.some(
        (o) =>
          !Number.isFinite(o.weight) ||
          !Number.isFinite(o.volume) ||
          o.weight < 0 ||
          o.volume < 0,
      ) ||
      foundVehicles.some(
        (v) =>
          !Number.isFinite(v.capacityW) ||
          !Number.isFinite(v.capacityV) ||
          v.capacityW <= 0 ||
          v.capacityV <= 0,
      )
    )
      throw new BadRequestException('订单重量体积必须非负，车辆容量必须为正数');
    const orders = dto.orderIds.map((id) =>
      foundOrders.find((o) => o.id === id)!,
    );
    const vehicles = dto.vehicleIds.map((id) =>
      foundVehicles.find((v) => v.id === id)!,
    );
    // Share a matrix point for orders at the same customer, allowing 500 orders plus a depot.
    const points: VrpPoint[] = [{ id: 'depot', ...dto.depot }];
    const indices = new Map<number, number>();
    for (const o of orders)
      if (!indices.has(o.customerId)) {
        indices.set(o.customerId, points.length);
        points.push({
          id: `customer-${o.customerId}`,
          lng: o.customer.lng,
          lat: o.customer.lat,
        });
      }
    if (indices.size > 100)
      throw new BadRequestException('课程演示单次最多选择 100 个客户');
    const matrix = await this.distanceMatrix(points);
    const timed = dto.algorithm !== 'CVRP-GA';
    if (
      timed &&
      orders.some(
        ({ customer: c }) =>
          !Number.isFinite(c.timeWindowStart) ||
          !Number.isFinite(c.timeWindowEnd) ||
          !Number.isFinite(c.serviceTime) ||
          c.timeWindowStart < 0 ||
          c.timeWindowEnd > 1440 ||
          c.timeWindowStart > c.timeWindowEnd ||
          c.serviceTime < 0,
      )
    ) {
      throw new BadRequestException(
        '客户时间窗必须满足 0 ≤ 开始 ≤ 结束 ≤ 1440，服务时长必须非负',
      );
    }
    const input: CvrpInput = {
      orders: orders.map((o) => ({
        orderId: o.id,
        pointIndex: indices.get(o.customerId)!,
        weight: o.weight,
        volume: o.volume,
        timeWindowStart: o.customer.timeWindowStart,
        timeWindowEnd: o.customer.timeWindowEnd,
        serviceTime: o.customer.serviceTime,
      })),
      vehicles: vehicles.map((v) => ({
        vehicleId: v.id,
        capacityW: v.capacityW,
        capacityV: v.capacityV,
      })),
      distances: matrix.distances,
      returnToDepot: dto.returnToDepot,
      ...(timed
        ? {
            timing: {
              departureTime: dto.departureTime,
              speedKmh: dto.speedKmh,
              penaltyPerMinute: dto.penaltyPerMinute,
            },
          }
        : {}),
    };
    if (dto.algorithm === 'NSGA-II') {
      const result = solveNsga2(input, dto.seed);
      return {
        ...result,
        ...(result.status === 'FOUND'
          ? this.previews.save(
              result.solutions.map((s) => ({
                ...s,
                routes: s.routes.map((r) => ({
                  ...r,
                  stops: r.orderIds.map((id, i) => {
                    const o = orders.find((o) => o.id === id)!;
                    return {
                      orderId: id,
                      seq: i + 1,
                      lng: o.customer.lng,
                      lat: o.customer.lat,
                    };
                  }),
                })),
              })),
              foundOrders,
              foundVehicles,
            )
          : {}),
        previewOnly: true,
        distanceModel: 'SPHERICAL',
        depot: dto.depot,
        returnToDepot: dto.returnToDepot,
        timeUnit: 'minutes-from-midnight',
        departureTime: dto.departureTime,
        speedKmh: dto.speedKmh,
        timeWindowPolicy: 'SOFT_SERVICE_START',
        objectives: ['totalDistance', 'usedVehicleCount', 'totalLateMinutes'],
        solutions: result.solutions.map((solution) => ({
          ...solution,
          routes: solution.routes.map((r) => ({
            ...r,
            totalCost: null,
            stops: r.orderIds.map((id, i) => {
              const o = orders.find((o) => o.id === id)!;
              return {
                seq: i + 1,
                orderId: id,
                customerId: o.customerId,
                lng: o.customer.lng,
                lat: o.customer.lat,
                ...r.schedule![i],
                timeWindowStart: o.customer.timeWindowStart,
                timeWindowEnd: o.customer.timeWindowEnd,
                serviceTime: o.customer.serviceTime,
              };
            }),
          })),
        })),
      };
    }
    const result = solveCvrp(input, dto.seed);
    return {
      ...result,
      solutionId: 'solution-1',
      ...(result.status === 'FOUND'
        ? this.previews.save(
            [
              {
                solutionId: 'solution-1',
                routes: result.routes.map((r) => ({
                  ...r,
                  stops: r.orderIds.map((id, i) => {
                    const o = orders.find((o) => o.id === id)!;
                    return {
                      orderId: id,
                      seq: i + 1,
                      lng: o.customer.lng,
                      lat: o.customer.lat,
                    };
                  }),
                })),
              },
            ],
            foundOrders,
            foundVehicles,
          )
        : {}),
      previewOnly: true,
      distanceModel: 'SPHERICAL',
      returnToDepot: dto.returnToDepot,
      depot: dto.depot,
      ...(timed
        ? {
            timeUnit: 'minutes-from-midnight',
            departureTime: dto.departureTime,
            speedKmh: dto.speedKmh,
            penaltyPerMinute: dto.penaltyPerMinute,
            timeWindowPolicy: 'SOFT_SERVICE_START',
            allTimeWindowsSatisfied:
              result.status === 'FOUND' && result.totalLateMinutes === 0,
          }
        : {}),
      message:
        result.status === 'FOUND'
          ? timed && result.totalLateMinutes! > 0
            ? '找到完整容量可行方案，但存在预计迟到；尚未创建调度任务'
            : '找到完整方案，尚未创建调度任务'
          : '本次搜索未找到完整方案，请调整车辆或订单；不代表已证明无解',
      routes: result.routes.map((r) => ({
        ...r,
        totalCost: null,
        stops: r.orderIds.map((id, i) => {
          const o = orders.find((o) => o.id === id)!;
          return {
            seq: i + 1,
            orderId: id,
            customerId: o.customerId,
            lng: o.customer.lng,
            lat: o.customer.lat,
            ...(timed
              ? {
                  ...r.schedule![i],
                  timeWindowStart: o.customer.timeWindowStart,
                  timeWindowEnd: o.customer.timeWindowEnd,
                  serviceTime: o.customer.serviceTime,
                }
              : {}),
          };
        }),
      })),
    };
  }
}
