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
    expect(result.routes.flatMap((r) => r.orderIds)).toHaveLength(50);
    expect(Date.now() - start).toBeLessThan(10000);
  });
});
