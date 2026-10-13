import { ConflictException, GoneException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface SavedRoute {
  vehicleId: number;
  orderIds: number[];
  totalDistance: number;
  stops: { orderId: number; lng: number; lat: number; seq: number }[];
}
export interface Preview {
  expiresAt: number;
  busy: boolean;
  consumed: boolean;
  orderIds: number[];
  vehicleIds: number[];
  fingerprint: string;
  solutions: { solutionId: string; routes: SavedRoute[] }[];
}
// Only optimization-relevant fields: timestamps and unrelated display fields do not invalidate a plan.
export function fingerprint(orders: any[], vehicles: any[]) {
  return JSON.stringify({
    orders: [...orders]
      .sort((a, b) => a.id - b.id)
      .map((o) => [
        o.id,
        o.status,
        o.customerId,
        o.weight,
        o.volume,
        o.customer.lng,
        o.customer.lat,
        o.customer.timeWindowStart,
        o.customer.timeWindowEnd,
        o.customer.serviceTime,
      ]),
    vehicles: [...vehicles]
      .sort((a, b) => a.id - b.id)
      .map((v) => [v.id, v.status, v.capacityW, v.capacityV]),
  });
}
@Injectable()
export class PreviewStore {
  private readonly entries = new Map<string, Preview>();
  save(solutions: Preview['solutions'], orders: any[], vehicles: any[]) {
    for (const [id, p] of this.entries)
      if (p.expiresAt < Date.now()) this.entries.delete(id);
    if (this.entries.size >= 200)
      this.entries.delete(this.entries.keys().next().value!);
    const id = randomUUID(),
      expiresAt = Date.now() + 15 * 60 * 1000;
    this.entries.set(id, {
      solutions,
      orderIds: orders.map((o) => o.id),
      vehicleIds: vehicles.map((v) => v.id),
      fingerprint: fingerprint(orders, vehicles),
      expiresAt,
      busy: false,
      consumed: false,
    });
    return {
      previewId: id,
      previewExpiresAt: new Date(expiresAt).toISOString(),
    };
  }
  acquire(id: string) {
    const p = this.entries.get(id);
    if (!p || p.expiresAt < Date.now())
      throw new GoneException('预览已过期或服务已重启，请重新计算');
    if (p.busy || p.consumed)
      throw new ConflictException('该方案正在确认或已经生成任务，请勿重复提交');
    p.busy = true;
    return p;
  }
}
