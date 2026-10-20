import { CvrpInput, CvrpRoute, stopTiming } from './cvrp';

export type Objectives = [number, number, number];
export function dominates(a: Objectives, b: Objectives): boolean {
  return a.every((v, i) => v <= b[i]) && a.some((v, i) => v < b[i]);
}
interface Candidate {
  order: number[];
  assignment: number[];
  routes: CvrpRoute[];
  objectives: Objectives;
  missing: number[];
  rank: number;
  crowd: number;
}
// Constraint domination: complete coverage precedes any incomplete candidate.
function better(a: Candidate, b: Candidate) {
  if (a.missing.length !== b.missing.length)
    return a.missing.length < b.missing.length;
  return dominates(a.objectives, b.objectives);
}
function fronts(pop: Candidate[]): Candidate[][] {
  const counts = pop.map(() => 0),
    beats = pop.map(() => [] as number[]);
  for (let i = 0; i < pop.length; i++)
    for (let j = i + 1; j < pop.length; j++) {
      if (better(pop[i], pop[j])) {
        beats[i].push(j);
        counts[j]++;
      } else if (better(pop[j], pop[i])) {
        beats[j].push(i);
        counts[i]++;
      }
    }
  let indices = counts.flatMap((n, i) => (n === 0 ? [i] : [])),
    rank = 0;
  const result: Candidate[][] = [];
  while (indices.length) {
    const next: number[] = [];
    result.push(
      indices.map((i) => {
        pop[i].rank = rank;
        return pop[i];
      }),
    );
    for (const i of indices)
      for (const j of beats[i]) if (--counts[j] === 0) next.push(j);
    indices = next;
    rank++;
  }
  for (const front of result) {
    front.forEach((c) => (c.crowd = 0));
    for (let objective = 0; objective < 3; objective++) {
      const sorted = [...front].sort(
        (a, b) => a.objectives[objective] - b.objectives[objective],
      );
      const range =
        sorted[sorted.length - 1].objectives[objective] -
        sorted[0].objectives[objective];
      if (range === 0) continue;
      sorted[0].crowd = sorted[sorted.length - 1].crowd = Infinity;
      for (let i = 1; i < sorted.length - 1; i++)
        sorted[i].crowd +=
          (sorted[i + 1].objectives[objective] -
            sorted[i - 1].objectives[objective]) /
          range;
    }
  }
  return result;
}

/** NSGA-II: non-dominated sorting, crowding tournaments, combined parent/child elitism. */
export function solveNsga2(input: CvrpInput, seed = 42) {
  if (!input.timing) throw new Error('NSGA-II requires timing');
  const timing = input.timing,
    m = input.vehicles.length,
    n = input.orders.length;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shuffle = (a: number[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const evaluate = (order: number[], assignment: number[]): Candidate => {
    const routes: CvrpRoute[] = input.vehicles.map((v) => ({
      vehicleId: v.vehicleId,
      orderIds: [],
      totalWeight: 0,
      totalVolume: 0,
      totalDistance: 0,
      schedule: [],
      endTime: timing.departureTime,
    }));
    const last = routes.map(() => 0),
      missing: number[] = [];
    for (const index of order) {
      const o = input.orders[index];
      const fits = (j: number) =>
        routes[j].totalWeight + o.weight <= input.vehicles[j].capacityW &&
        routes[j].totalVolume + o.volume <= input.vehicles[j].capacityV;
      let j = assignment[index];
      if (!fits(j)) j = routes.findIndex((_, k) => fits(k));
      if (j < 0) {
        missing.push(o.orderId);
        continue;
      }
      const r = routes[j],
        distance = input.distances[last[j]][o.pointIndex];
      const schedule = stopTiming(
        r.endTime! + distance / ((timing.speedKmh * 1000) / 60),
        o,
      );
      r.orderIds.push(o.orderId);
      r.totalWeight += o.weight;
      r.totalVolume += o.volume;
      r.totalDistance += distance;
      r.schedule!.push(schedule);
      r.endTime = schedule.departureTime;
      last[j] = o.pointIndex;
    }
    const used = routes.filter((r, j) => {
      if (!r.orderIds.length) return false;
      if (input.returnToDepot) {
        r.totalDistance += input.distances[last[j]][0];
        r.endTime! +=
          input.distances[last[j]][0] / ((timing.speedKmh * 1000) / 60);
      }
      return true;
    });
    return {
      order,
      assignment,
      routes: used,
      missing,
      rank: 0,
      crowd: 0,
      objectives: [
        used.reduce((s, r) => s + r.totalDistance, 0),
        used.length,
        used.reduce(
          (s, r) => s + r.schedule!.reduce((a, t) => a + t.lateMinutes, 0),
          0,
        ),
      ],
    };
  };
  const base = input.orders.map((_, i) => i),
    size = 48;
  let pop = Array.from({ length: size }, (_, i) =>
    evaluate(
      i === 0 ? base : shuffle(base),
      base.map((j) => (i < m ? i : i === m ? j % m : Math.floor(random() * m))),
    ),
  );
  for (let generation = 0; generation < 100; generation++) {
    fronts(pop);
    const tournament = () => {
      const a = pop[Math.floor(random() * size)],
        b = pop[Math.floor(random() * size)];
      return a.rank < b.rank || (a.rank === b.rank && a.crowd > b.crowd)
        ? a
        : b;
    };
    const children: Candidate[] = [];
    while (children.length < size) {
      const a = tournament(),
        b = tournament();
      const start = Math.floor(random() * n),
        end = start + Math.floor(random() * (n - start)) + 1;
      const segment = a.order.slice(start, end),
        taken = new Set(segment),
        rest = b.order.filter((i) => !taken.has(i));
      const order = [...rest.slice(0, start), ...segment, ...rest.slice(start)];
      const assignment = a.assignment.map((v, i) =>
        random() < 0.5 ? v : b.assignment[i],
      );
      if (n > 1 && random() < 0.4) {
        const i = Math.floor(random() * n),
          j = Math.floor(random() * n);
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (let i = 0; i < n; i++)
        if (random() < 1 / n) assignment[i] = Math.floor(random() * m);
      children.push(evaluate(order, assignment));
    }
    const next: Candidate[] = [];
    for (const front of fronts([...pop, ...children])) {
      const slots = size - next.length;
      if (front.length <= slots) next.push(...front);
      else {
        next.push(...front.sort((a, b) => b.crowd - a.crowd).slice(0, slots));
        break;
      }
      if (next.length === size) break;
    }
    pop = next;
  }
  const feasible = pop.filter((c) => c.missing.length === 0);
  const seen = new Set<string>();
  const best = feasible.length ? fronts(feasible)[0] : [];
  const solutions = best
    .filter((c) => {
      const key = JSON.stringify(c.objectives);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(
      (a, b) =>
        a.objectives[0] - b.objectives[0] ||
        a.objectives[1] - b.objectives[1] ||
        a.objectives[2] - b.objectives[2],
    )
    .map((c, i) => ({
      solutionId: `solution-${i + 1}`,
      routes: c.routes,
      totalDistance: c.objectives[0],
      usedVehicleCount: c.objectives[1],
      totalLateMinutes: c.objectives[2],
      allTimeWindowsSatisfied: c.objectives[2] === 0,
    }));
  return {
    algorithm: 'NSGA-II' as const,
    status: solutions.length ? 'FOUND' : 'NOT_FOUND',
    solutions,
    distanceUnit: 'm',
    paretoScope: 'APPROXIMATE_SEARCH_FRONT',
    message: solutions.length
      ? '返回本次搜索的非支配方案，请选择后再生成任务；不保证全局最优'
      : '本次搜索未找到完整方案，不代表已证明无解',
  };
}
