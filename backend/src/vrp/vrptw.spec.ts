import { solveCvrp, stopTiming, CvrpInput } from './cvrp';
describe('VRPTW scheduling', () => {
  const order = {
    orderId: 1,
    pointIndex: 1,
    weight: 1,
    volume: 1,
    timeWindowStart: 500,
    timeWindowEnd: 510,
    serviceTime: 10,
  };
  const input: CvrpInput = {
    orders: [order],
    vehicles: [{ vehicleId: 1, capacityW: 2, capacityV: 2 }],
    distances: [
      [0, 1000],
      [1000, 0],
    ],
    returnToDepot: true,
    timing: { departureTime: 480, speedKmh: 60, penaltyPerMinute: 1000 },
  };
  it('waits until window opening and includes service and depot return', () => {
    const r = solveCvrp(input);
    expect(r.algorithm).toBe('VRPTW-GA');
    expect(r.routes[0].schedule![0]).toEqual({
      arrivalTime: 481,
      serviceStartTime: 500,
      departureTime: 510,
      waitingMinutes: 19,
      lateMinutes: 0,
    });
    expect(r.routes[0].endTime).toBe(511);
    expect(r.objectiveScore).toBe(2000);
  });
  it('counts lateness and allows soft window violations', () => {
    const r = solveCvrp({
      ...input,
      timing: { ...input.timing!, departureTime: 520 },
    });
    expect(r.status).toBe('FOUND');
    expect(r.totalLateMinutes).toBe(11);
    expect(r.objectiveScore).toBe(13000);
  });
  it('uses service start boundary, not service completion', () => {
    expect(stopTiming(510, order).lateMinutes).toBe(0);
    expect(stopTiming(510, order).departureTime).toBe(520);
  });
  it('propagates service duration and optimizes urgent order before flexible order', () => {
    const flexible = {
      ...order,
      orderId: 1,
      timeWindowStart: 0,
      timeWindowEnd: 1440,
      serviceTime: 20,
    };
    const urgent = {
      ...order,
      orderId: 2,
      pointIndex: 2,
      timeWindowStart: 0,
      timeWindowEnd: 485,
      serviceTime: 1,
    };
    const r = solveCvrp({
      ...input,
      orders: [flexible, urgent],
      distances: [
        [0, 1000, 1000],
        [1000, 0, 1000],
        [1000, 1000, 0],
      ],
    });
    expect(r.routes[0].orderIds).toEqual([2, 1]);
    expect(r.totalLateMinutes).toBe(0);
    expect(r.routes[0].schedule![1].arrivalTime).toBe(483);
  });
  it('does not relax capacity to meet time windows', () => {
    const r = solveCvrp({
      ...input,
      vehicles: [{ vehicleId: 1, capacityW: 0.5, capacityV: 2 }],
    });
    expect(r.status).toBe('NOT_FOUND');
    expect(r.unassignedOrderIds).toEqual([1]);
  });
});
