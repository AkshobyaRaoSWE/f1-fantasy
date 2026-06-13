// Form analysis: turn baked race results into per-asset projections.
// Pure functions — no fetching here. Page passes the JSON in.

import {
  CONSTRUCTORS,
  DRIVERS,
  driverByNumber,
  teamDrivers,
  teammate,
  type Constructor,
  type Driver,
} from "./data";
import {
  scoreDriverWeekend,
  scoreConstructorWeekend,
  type RaceResult,
} from "./scoring";

export type FormRound = {
  round: number;
  raceName: string;
  date: string;
  country: string;
  locality: string;
  hasSprint: boolean;
  results: RaceResult[];
  sprintResults: RaceResult[] | null;
};

export type FormFile = {
  generated: string;
  season: number;
  schedule: { round: number; raceName: string; date: string; country: string; locality: string }[];
  rounds: FormRound[];
};

export type RoundScore = { round: number; raceName: string; points: number };

export type DriverProjection = {
  driver: Driver;
  history: RoundScore[]; // newest last
  avg: number;            // simple mean
  weighted: number;       // recency-weighted projection
  trend: number;          // slope over history (pts per round)
  pricePerPoint: number;  // price / weighted (lower = better)
  pointsPerMillion: number; // weighted / price
  startsCounted: number;
};

export type ConstructorProjection = {
  constructor: Constructor;
  history: RoundScore[];
  avg: number;
  weighted: number;
  trend: number;
  pricePerPoint: number;
  pointsPerMillion: number;
  startsCounted: number;
};

export type Projections = {
  drivers: DriverProjection[];          // all drivers, sorted by weighted desc
  constructors: ConstructorProjection[];
  byDriverNumber: Map<number, DriverProjection>;
  byConstructorId: Map<string, ConstructorProjection>;
  rounds: FormRound[];                  // newest last
  nextRound: { round: number; raceName: string; date: string; country: string; locality: string } | null;
};

function recencyWeights(n: number): number[] {
  // Linear ramp: oldest weight 1, newest weight n.
  // Means newest race counts ~n× more than oldest. Sensible for short seasons.
  const ws: number[] = [];
  for (let i = 0; i < n; i++) ws.push(i + 1);
  return ws;
}

function weightedMean(xs: number[], ws: number[]): number {
  let num = 0,
    den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += xs[i] * ws[i];
    den += ws[i];
  }
  return den === 0 ? 0 : num / den;
}

function linearTrend(xs: number[]): number {
  // OLS slope on (i, xs[i])
  const n = xs.length;
  if (n < 2) return 0;
  const xbar = (n - 1) / 2;
  const ybar = xs.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xbar) * (xs[i] - ybar);
    den += (i - xbar) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function computeProjections(file: FormFile): Projections {
  const driverProjs: DriverProjection[] = [];
  const cProjs: ConstructorProjection[] = [];

  for (const drv of DRIVERS) {
    const tm = teammate(drv);
    const history: RoundScore[] = [];
    for (const r of file.rounds) {
      const sess = {
        hasSprint: r.hasSprint,
        results: r.results,
        sprintResults: r.sprintResults ?? undefined,
      };
      // Skip if driver wasn't in this race (number not in results).
      if (!r.results.find((x) => x.driverNumber === drv.number)) continue;
      const pts = scoreDriverWeekend(drv.number, sess, tm?.number ?? null);
      history.push({ round: r.round, raceName: r.raceName, points: pts });
    }
    const xs = history.map((h) => h.points);
    const ws = recencyWeights(xs.length);
    const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const weighted = weightedMean(xs, ws);
    const proj: DriverProjection = {
      driver: drv,
      history,
      avg,
      weighted,
      trend: linearTrend(xs),
      pricePerPoint: weighted > 0 ? drv.price / weighted : Infinity,
      pointsPerMillion: drv.price > 0 ? weighted / drv.price : 0,
      startsCounted: xs.length,
    };
    driverProjs.push(proj);
  }

  for (const con of CONSTRUCTORS) {
    const drivers = teamDrivers(con.id);
    const history: RoundScore[] = [];
    for (const r of file.rounds) {
      const sess = {
        hasSprint: r.hasSprint,
        results: r.results,
        sprintResults: r.sprintResults ?? undefined,
      };
      const inRace = drivers.some((d) =>
        r.results.some((x) => x.driverNumber === d.number),
      );
      if (!inRace) continue;
      const pts = scoreConstructorWeekend(
        drivers.map((d) => d.number),
        sess,
      );
      history.push({ round: r.round, raceName: r.raceName, points: pts });
    }
    const xs = history.map((h) => h.points);
    const ws = recencyWeights(xs.length);
    const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    const weighted = weightedMean(xs, ws);
    cProjs.push({
      constructor: con,
      history,
      avg,
      weighted,
      trend: linearTrend(xs),
      pricePerPoint: weighted > 0 ? con.price / weighted : Infinity,
      pointsPerMillion: con.price > 0 ? weighted / con.price : 0,
      startsCounted: xs.length,
    });
  }

  driverProjs.sort((a, b) => b.weighted - a.weighted);
  cProjs.sort((a, b) => b.weighted - a.weighted);

  const byDriverNumber = new Map(driverProjs.map((p) => [p.driver.number, p]));
  const byConstructorId = new Map(cProjs.map((p) => [p.constructor.id, p]));

  const lastRound = file.rounds[file.rounds.length - 1]?.round ?? 0;
  const nextRound =
    file.schedule.find((s) => s.round === lastRound + 1) ?? null;

  return {
    drivers: driverProjs,
    constructors: cProjs,
    byDriverNumber,
    byConstructorId,
    rounds: file.rounds,
    nextRound,
  };
}

// Helper for unknown driver lookup (e.g. last-second roster change).
export function safeDriverName(num: number): string {
  const d = driverByNumber(num);
  return d ? d.acronym : `#${num}`;
}
