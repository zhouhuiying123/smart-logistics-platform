import { solveCvrp, CvrpInput } from './cvrp';

describe('CVRP-GA', () => {
  const input: CvrpInput = {
    orders: [1, 2, 3, 4].map((i) => ({
      orderId: i,
      pointIndex: i,
      weight: 2,
      volume: 3,
    })),
    vehicles: [1, 2].map((i) => ({ vehicleId: i, capacityW: 4, capacityV: 6 })),
    distances: Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => Math.abs(i - j) * 100),
    ),
    returnToDepot: true,
  };
  it('covers each order once with both capacities satisfied and correct round trip distance', () => {
    const result = solveCvrp(input);
    expect(result.status).toBe('FOUND');
    expect(result.routes.flatMap((r) => r.orderIds).sort()).toEqual([
      1, 2, 3, 4,
    ]);
    for (const r of result.routes) {
      expect(r.totalWeight).toBeLessThanOrEqual(4);
      expect(r.totalVolume).toBeLessThanOrEqual(6);
      const path = [0, ...r.orderIds, 0];
      expect(r.totalDistance).toBe(
        path.slice(1).reduce((s, p, i) => s + input.distances[path[i]][p], 0),
      );
    }
    expect(solveCvrp(input)).toEqual(result);
  });
  it('records actual generations without changing the seeded solution', () => {
    const scores: number[] = [];
    const result = solveCvrp(input, 42, (generation, best) => {
      expect(generation).toBe(scores.length);
      scores.push(best.totalDistance);
    });
    // 同 seed 结果完全一致（确定性）
    expect(result).toEqual(solveCvrp(input, 42));
    // 调优后：200 代 + 最终回调 = 201 次
    expect(scores.length).toBeGreaterThanOrEqual(201);
    expect(scores[scores.length - 1]).toBe(result.totalDistance);
    // 最优值单调不增（精英保留保证，允许浮点误差）
    let nonIncreasing = true;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[i - 1] + 0.5) { nonIncreasing = false; break; }
    }
    expect(nonIncreasing).toBe(true);
  });
  it('reports uncovered orders rather than overloading volume', () => {
    const result = solveCvrp({
      ...input,
      vehicles: [{ vehicleId: 1, capacityW: 100, capacityV: 3 }],
    });
    expect(result.status).toBe('NOT_FOUND');
    expect(result.unassignedOrderIds).toHaveLength(3);
    expect(result.routes[0].totalVolume).toBe(3);
  });
  it('does not overload weight', () => {
    const result = solveCvrp({
      ...input,
      vehicles: [{ vehicleId: 1, capacityW: 1, capacityV: 100 }],
    });
    expect(result.routes).toEqual([]);
    expect(result.unassignedOrderIds).toHaveLength(4);
  });
  it('supports open routes and one order', () => {
    const result = solveCvrp({
      ...input,
      orders: input.orders.slice(0, 1),
      returnToDepot: false,
    });
    expect(result.status).toBe('FOUND');
    expect(result.totalDistance).toBe(100);
  });
  it('handles 50 orders with complete coverage within 10 seconds', () => {
    const large: CvrpInput = {
      orders: Array.from({ length: 50 }, (_, i) => ({
        orderId: i + 1,
        pointIndex: i + 1,
        weight: 1,
        volume: 1,
      })),
      vehicles: Array.from({ length: 5 }, (_, i) => ({
        vehicleId: i,
        capacityW: 10,
        capacityV: 10,
      })),
      distances: Array.from({ length: 51 }, (_, i) =>
        Array.from({ length: 51 }, (_, j) => Math.abs(i - j)),
      ),
      returnToDepot: true,
    };
    const start = Date.now();
    const result = solveCvrp(large);
    expect(result.status).toBe('FOUND');
    const covered = result.routes.flatMap((r) => r.orderIds).sort((a, b) => a - b);
    expect(covered).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    // 容量不超限
    for (const r of result.routes) {
      const v = large.vehicles.find((vv) => vv.vehicleId === r.vehicleId)!;
      expect(r.totalWeight).toBeLessThanOrEqual(v.capacityW);
      expect(r.totalVolume).toBeLessThanOrEqual(v.capacityV);
    }
    expect(Date.now() - start).toBeLessThan(10000);
  });
});
