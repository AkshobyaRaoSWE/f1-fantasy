// Lineup optimizer.
// Full enumeration with budget pruning. ~700K lineups × O(7) eval, runs in
// well under 100ms on a laptop. No external solver needed.

import {
  BUDGET_CAP,
  DRS_BOOST_MULTIPLIER,
  SQUAD_SIZE,
  type Constructor,
  type Driver,
} from "./data";
import type {
  ConstructorProjection,
  DriverProjection,
  Projections,
} from "./form";

export type Lineup = {
  drivers: Driver[];
  constructors: Constructor[];
  drsBoostDriver: Driver;
  cost: number;
  projected: number;        // total expected points incl. DRS Boost
  baseProjected: number;    // without boost
  boostedDriverGain: number;
  remainingBudget: number;
};

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const n = items.length;
  if (k > n || k <= 0) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => items[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

function lineupOf(
  drivers: DriverProjection[],
  constructors: ConstructorProjection[],
  budget: number,
): Lineup | null {
  const cost =
    drivers.reduce((s, d) => s + d.driver.price, 0) +
    constructors.reduce((s, c) => s + c.constructor.price, 0);
  if (cost > budget) return null;

  const baseProjected =
    drivers.reduce((s, d) => s + d.weighted, 0) +
    constructors.reduce((s, c) => s + c.weighted, 0);

  // Captain = driver with highest weighted (DRS Boost adds (mult-1)x of their projected).
  let captain = drivers[0];
  let bestExtra = -Infinity;
  for (const d of drivers) {
    const extra = d.weighted * (DRS_BOOST_MULTIPLIER - 1);
    if (extra > bestExtra) {
      bestExtra = extra;
      captain = d;
    }
  }
  const projected = baseProjected + bestExtra;

  return {
    drivers: drivers.map((d) => d.driver),
    constructors: constructors.map((c) => c.constructor),
    drsBoostDriver: captain.driver,
    cost,
    projected,
    baseProjected,
    boostedDriverGain: bestExtra,
    remainingBudget: budget - cost,
  };
}

export type OptimizeOptions = {
  budget?: number;
  topK?: number;
  lockDrivers?: number[];           // driver numbers to require
  lockConstructors?: string[];      // constructor ids to require
  excludeDrivers?: number[];
  excludeConstructors?: string[];
};

export function optimize(
  proj: Projections,
  opts: OptimizeOptions = {},
): Lineup[] {
  const budget = opts.budget ?? BUDGET_CAP;
  const topK = opts.topK ?? 10;

  let drivers = proj.drivers.slice();
  let constructors = proj.constructors.slice();
  if (opts.excludeDrivers?.length) {
    const ex = new Set(opts.excludeDrivers);
    drivers = drivers.filter((d) => !ex.has(d.driver.number));
  }
  if (opts.excludeConstructors?.length) {
    const ex = new Set(opts.excludeConstructors);
    constructors = constructors.filter((c) => !ex.has(c.constructor.id));
  }

  const lockedD = new Set(opts.lockDrivers ?? []);
  const lockedC = new Set(opts.lockConstructors ?? []);
  const required = drivers.filter((d) => lockedD.has(d.driver.number));
  const requiredC = constructors.filter((c) =>
    lockedC.has(c.constructor.id),
  );
  const optional = drivers.filter((d) => !lockedD.has(d.driver.number));
  const optionalC = constructors.filter((c) => !lockedC.has(c.constructor.id));

  if (required.length > SQUAD_SIZE.drivers) return [];
  if (requiredC.length > SQUAD_SIZE.constructors) return [];

  const driverPicks = combinations(
    optional,
    SQUAD_SIZE.drivers - required.length,
  );
  const conPicks = combinations(
    optionalC,
    SQUAD_SIZE.constructors - requiredC.length,
  );

  const heap: Lineup[] = [];
  for (const dp of driverPicks) {
    const ds = required.concat(dp);
    const driverCost = ds.reduce((s, d) => s + d.driver.price, 0);
    if (driverCost > budget) continue;
    for (const cp of conPicks) {
      const cs = requiredC.concat(cp);
      const lineup = lineupOf(ds, cs, budget);
      if (!lineup) continue;
      if (heap.length < topK) {
        heap.push(lineup);
        heap.sort((a, b) => a.projected - b.projected); // ascending
      } else if (lineup.projected > heap[0].projected) {
        heap[0] = lineup;
        heap.sort((a, b) => a.projected - b.projected);
      }
    }
  }
  heap.sort((a, b) => b.projected - a.projected); // descending
  return heap;
}

export type TransferSuggestion = {
  outDriver?: Driver;
  inDriver?: Driver;
  outConstructor?: Constructor;
  inConstructor?: Constructor;
  costDelta: number;
  projectedDelta: number;
};

export function suggestTransfers(
  current: { drivers: Driver[]; constructors: Constructor[] },
  proj: Projections,
  budget = BUDGET_CAP,
  topK = 10,
): TransferSuggestion[] {
  const cost =
    current.drivers.reduce((s, d) => s + d.price, 0) +
    current.constructors.reduce((s, c) => s + c.price, 0);
  const headroom = budget - cost;
  const inSet = new Set(current.drivers.map((d) => d.number));
  const inConSet = new Set(current.constructors.map((c) => c.id));
  const out: TransferSuggestion[] = [];

  // Single driver swap.
  for (const cur of current.drivers) {
    const curProj = proj.byDriverNumber.get(cur.number);
    if (!curProj) continue;
    for (const cand of proj.drivers) {
      if (inSet.has(cand.driver.number)) continue;
      const costDelta = cand.driver.price - cur.price;
      if (costDelta > headroom + 1e-9) continue;
      const projectedDelta = cand.weighted - curProj.weighted;
      if (projectedDelta <= 0) continue;
      out.push({
        outDriver: cur,
        inDriver: cand.driver,
        costDelta,
        projectedDelta,
      });
    }
  }

  // Single constructor swap.
  for (const cur of current.constructors) {
    const curProj = proj.byConstructorId.get(cur.id);
    if (!curProj) continue;
    for (const cand of proj.constructors) {
      if (inConSet.has(cand.constructor.id)) continue;
      const costDelta = cand.constructor.price - cur.price;
      if (costDelta > headroom + 1e-9) continue;
      const projectedDelta = cand.weighted - curProj.weighted;
      if (projectedDelta <= 0) continue;
      out.push({
        outConstructor: cur,
        inConstructor: cand.constructor,
        costDelta,
        projectedDelta,
      });
    }
  }

  out.sort((a, b) => b.projectedDelta - a.projectedDelta);
  return out.slice(0, topK);
}

// Hindsight: for each historical round, what was the best possible lineup?
// This is the same enumeration but using actual points scored that round
// instead of projections.
export type HindsightLineup = {
  round: number;
  raceName: string;
  best: Lineup;
};

export function hindsightForRound(
  proj: Projections,
  round: number,
  budget = BUDGET_CAP,
): HindsightLineup | null {
  const r = proj.rounds.find((x) => x.round === round);
  if (!r) return null;

  // Build per-asset "weighted" overridden with actual round points.
  const driverProjs: DriverProjection[] = [];
  for (const dp of proj.drivers) {
    const h = dp.history.find((x) => x.round === round);
    const pts = h?.points ?? 0;
    if (!h) continue; // skip drivers not in this race
    driverProjs.push({ ...dp, weighted: pts });
  }
  const conProjs: ConstructorProjection[] = [];
  for (const cp of proj.constructors) {
    const h = cp.history.find((x) => x.round === round);
    if (!h) continue;
    conProjs.push({ ...cp, weighted: h.points });
  }
  const fakeProj: Projections = {
    ...proj,
    drivers: driverProjs.sort((a, b) => b.weighted - a.weighted),
    constructors: conProjs.sort((a, b) => b.weighted - a.weighted),
    byDriverNumber: new Map(driverProjs.map((p) => [p.driver.number, p])),
    byConstructorId: new Map(conProjs.map((p) => [p.constructor.id, p])),
  };
  const tops = optimize(fakeProj, { budget, topK: 1 });
  if (!tops[0]) return null;
  return { round, raceName: r.raceName, best: tops[0] };
}
