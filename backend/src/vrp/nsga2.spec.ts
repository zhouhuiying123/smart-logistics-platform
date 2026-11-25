import { solveNsga2, dominates, Objectives } from './nsga2';
import { CvrpInput } from './cvrp';
describe('NSGA-II', () => {
  const input: CvrpInput = {
    orders: [1, 2].map((i) => ({
      orderId: i,
      pointIndex: i,
      weight: 1,
      volume: 1,
      timeWindowStart: 0,
      timeWindowEnd: 485,
      serviceTime: 10,
    })),
    vehicles: [1, 2].map((i) => ({ vehicleId: i, capacityW: 2, capacityV: 2 })),
    distances: [
      [0, 1000, 1000],
      [1000, 0, 1000],
      [1000, 1000, 0],
    ],
    returnToDepot: true,
    timing: { departureTime: 480, speedKmh: 60, penaltyPerMinute: 1000 },
  };
  it('compares all objectives with at least one strict improvement', () => {
    expect(dominates([1, 2, 3], [2, 2, 3])).toBe(true);
    expect(dominates([1, 2, 3], [1, 2, 3])).toBe(false);
    expect(dominates([1, 3, 0], [2, 2, 0])).toBe(false);
  });
  it('finds tradeoff Pareto front, preserves capacity and exact coverage, is repeatable', () => {
    const r = solveNsga2(input);
    expect(r.status).toBe('FOUND');
    // 至少两条 tradeoff 解（1 车迟到 vs 2 车准点）
    expect(r.solutions.length).toBeGreaterThanOrEqual(2);
    // 同 seed 结果完全一致（确定性）
    expect(solveNsga2(input)).toEqual(r);
    // 每个解都完整覆盖所有订单 + 容量约束
    for (const s of r.solutions) {
      expect(s.routes.flatMap((r) => r.orderIds).sort()).toEqual([1, 2]);
      for (const route of s.routes) {
        expect(route.totalWeight).toBeLessThanOrEqual(2);
        expect(route.totalVolume).toBeLessThanOrEqual(2);
      }
    }
    // Pareto 前沿：任意两个解互不支配
    const objectives = r.solutions.map(
      (s) =>
        [s.totalDistance, s.usedVehicleCount, s.totalLateMinutes] as Objectives,
    );
    expect(
      objectives.some((a) => objectives.some((b) => a !== b && dominates(a, b))),
    ).toBe(false);
  });
  it('returns no partial solution when capacity is impossible', () => {
    const r = solveNsga2({
      ...input,
      vehicles: [{ vehicleId: 1, capacityW: 0.5, capacityV: 100 }],
    });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.solutions).toEqual([]);
  });
  it('handles a single order and open route', () => {
    const r = solveNsga2({
      ...input,
      orders: input.orders.slice(0, 1),
      returnToDepot: false,
    });
    expect(r.solutions[0].totalDistance).toBe(1000);
  });
});
