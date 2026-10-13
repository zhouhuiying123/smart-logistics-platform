/** Pure CVRP solver: permutation GA with capacity-safe greedy decoding. */
export interface CvrpOrder {
  orderId: number;
  pointIndex: number;
  weight: number;
  volume: number;
  timeWindowStart?: number;
  timeWindowEnd?: number;
  serviceTime?: number;
}
export interface CvrpVehicle {
  vehicleId: number;
  capacityW: number;
  capacityV: number;
}
export interface CvrpInput {
  orders: CvrpOrder[];
  vehicles: CvrpVehicle[];
  distances: number[][];
  returnToDepot: boolean;
  timing?: {
    departureTime: number;
    speedKmh: number;
    penaltyPerMinute: number;
  };
}
export interface StopTiming {
  arrivalTime: number;
  serviceStartTime: number;
  departureTime: number;
  waitingMinutes: number;
  lateMinutes: number;
}
export function stopTiming(arrivalTime: number, order: CvrpOrder): StopTiming {
  const serviceStartTime = Math.max(arrivalTime, order.timeWindowStart!);
  return {
    arrivalTime,
    serviceStartTime,
    departureTime: serviceStartTime + order.serviceTime!,
    waitingMinutes: serviceStartTime - arrivalTime,
    lateMinutes: Math.max(0, serviceStartTime - order.timeWindowEnd!),
  };
}
export interface CvrpRoute {
  vehicleId: number;
  orderIds: number[];
  totalWeight: number;
  totalVolume: number;
  totalDistance: number;
  schedule?: StopTiming[];
  endTime?: number;
}
export interface CvrpResult {
  algorithm: 'CVRP-GA' | 'VRPTW-GA';
  status: 'FOUND' | 'NOT_FOUND';
  routes: CvrpRoute[];
  unassignedOrderIds: number[];
  totalDistance: number;
  usedVehicleCount: number;
  distanceUnit: 'm';
  totalLateMinutes?: number;
  objectiveScore?: number;
}

export function solveCvrp(input: CvrpInput, seed = 42): CvrpResult {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const decode = (genes: number[]): CvrpResult => {
    const routes: CvrpRoute[] = input.vehicles.map((v) => ({
      vehicleId: v.vehicleId,
      orderIds: [] as number[],
      totalWeight: 0,
      totalVolume: 0,
      totalDistance: 0,
      ...(input.timing
        ? { schedule: [] as StopTiming[], endTime: input.timing.departureTime }
        : {}),
    }));
    const last = routes.map(() => 0);
    const unassignedOrderIds: number[] = [];
    for (const gene of genes) {
      const order = input.orders[gene];
      let selected = -1,
        cheapest = Infinity;
      for (let j = 0; j < routes.length; j++) {
        const r = routes[j],
          v = input.vehicles[j];
        if (
          r.totalWeight + order.weight > v.capacityW ||
          r.totalVolume + order.volume > v.capacityV
        )
          continue;
        let added =
          input.distances[last[j]][order.pointIndex] +
          (input.returnToDepot
            ? input.distances[order.pointIndex][0] - input.distances[last[j]][0]
            : 0);
        if (input.timing) {
          const arrival =
            r.endTime! +
            input.distances[last[j]][order.pointIndex] /
              ((input.timing.speedKmh * 1000) / 60);
          added +=
            stopTiming(arrival, order).lateMinutes *
            input.timing.penaltyPerMinute;
        }
        if (added < cheapest) {
          cheapest = added;
          selected = j;
        }
      }
      if (selected < 0) {
        unassignedOrderIds.push(order.orderId);
        continue;
      }
      const r = routes[selected];
      r.orderIds.push(order.orderId);
      r.totalWeight += order.weight;
      r.totalVolume += order.volume;
      r.totalDistance += input.distances[last[selected]][order.pointIndex];
      if (input.timing) {
        const arrival =
          r.endTime! +
          input.distances[last[selected]][order.pointIndex] /
            ((input.timing.speedKmh * 1000) / 60);
        const timing = stopTiming(arrival, order);
        r.schedule!.push(timing);
        r.endTime = timing.departureTime;
      }
      last[selected] = order.pointIndex;
    }
    if (input.returnToDepot)
      routes.forEach((r, j) => {
        if (r.orderIds.length) {
          r.totalDistance += input.distances[last[j]][0];
          if (input.timing)
            r.endTime! +=
              input.distances[last[j]][0] /
              ((input.timing.speedKmh * 1000) / 60);
        }
      });
    const used = routes.filter((r) => r.orderIds.length);
    const totalLateMinutes = used.reduce(
      (sum, r) =>
        sum + (r.schedule ?? []).reduce((s, t) => s + t.lateMinutes, 0),
      0,
    );
    const totalDistance = used.reduce((s, r) => s + r.totalDistance, 0);
    return {
      algorithm: input.timing ? 'VRPTW-GA' : 'CVRP-GA',
      status: unassignedOrderIds.length ? 'NOT_FOUND' : 'FOUND',
      routes: used,
      unassignedOrderIds,
      totalDistance,
      ...(input.timing
        ? {
            totalLateMinutes,
            objectiveScore:
              totalDistance + totalLateMinutes * input.timing.penaltyPerMinute,
          }
        : {}),
      usedVehicleCount: used.length,
      distanceUnit: 'm',
    };
  };
  const shuffle = (a: number[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const evaluate = (genes: number[]) => ({ genes, result: decode(genes) });
  type Candidate = ReturnType<typeof evaluate>;
  // Feasibility always ranks ahead of distance. Never describe partial coverage as a solution.
  const compare = (a: Candidate, b: Candidate) =>
    a.result.unassignedOrderIds.length - b.result.unassignedOrderIds.length ||
    (a.result.objectiveScore ?? a.result.totalDistance) -
      (b.result.objectiveScore ?? b.result.totalDistance);
  const base = input.orders.map((_, i) => i);
  let population = Array.from({ length: 40 }, (_, i) =>
    evaluate(i === 0 ? base : shuffle(base)),
  );
  for (let generation = 0; generation < 120; generation++) {
    population.sort(compare);
    const next = population.slice(0, 2);
    const select = () => {
      const candidates = Array.from(
        { length: 3 },
        () => population[Math.floor(random() * population.length)],
      );
      return candidates.sort(compare)[0].genes;
    };
    while (next.length < 40) {
      const a = select(),
        b = select();
      const left = Math.floor(random() * a.length),
        right = Math.floor(random() * a.length);
      const start = Math.min(left, right),
        end = Math.max(left, right) + 1;
      const segment = a.slice(start, end),
        taken = new Set(segment);
      const remainder = b.filter((x) => !taken.has(x));
      const child = [
        ...remainder.slice(0, start),
        ...segment,
        ...remainder.slice(start),
      ];
      if (child.length > 1 && random() < 0.3) {
        const i = Math.floor(random() * child.length),
          j = Math.floor(random() * child.length);
        [child[i], child[j]] = [child[j], child[i]];
      }
      next.push(evaluate(child));
    }
    population = next;
  }
  return population.sort(compare)[0].result;
}
