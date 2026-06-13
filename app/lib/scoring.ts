// 2026 F1 Fantasy scoring rules.
// All values are placeholders matching recent seasons [VERIFY THIS].
// Tweak in one place; the optimizer reads the same constants.

export const QUALI_POINTS: number[] = [
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const RACE_POINTS: number[] = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const SPRINT_POINTS: number[] = [
  8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

export const FASTEST_LAP = 10;
export const DRIVER_OF_THE_DAY = 10;
export const POLE_BONUS = 0; // already baked into QUALI_POINTS

export const POSITIONS_GAINED_PER = 1;     // per net place gained vs. grid
export const POSITIONS_LOST_PER = -1;      // per net place lost
export const POSITIONS_GAINED_CAP = 10;    // cap so a single race doesn't dominate

export const BEAT_TEAMMATE_QUALI = 3;
export const BEAT_TEAMMATE_RACE = 5;

export const DNF = -15;
export const DSQ = -20;
export const DNS = -20;

export type RaceResult = {
  driverNumber: number;
  gridPosition: number | null;
  finishPosition: number | null;
  qualiPosition: number | null;
  fastestLap: boolean;
  dotd: boolean;
  status: "finished" | "dnf" | "dsq" | "dns";
};

export type SessionScoring = {
  hasSprint: boolean;
  // Filled in: per-driver result rows for race + sprint where applicable.
  results: RaceResult[];
  sprintResults?: RaceResult[];
};

export function scoreDriverWeekend(
  driverNumber: number,
  sess: SessionScoring,
  teammateNumber: number | null,
): number {
  const r = sess.results.find((x) => x.driverNumber === driverNumber);
  if (!r) return 0;
  let pts = 0;

  if (r.qualiPosition && r.qualiPosition >= 1)
    pts += QUALI_POINTS[r.qualiPosition - 1] ?? 0;

  if (r.status === "dns") return DNS;
  if (r.status === "dsq") return DSQ;

  if (r.status === "finished" && r.finishPosition && r.finishPosition >= 1)
    pts += RACE_POINTS[r.finishPosition - 1] ?? 0;

  if (r.status === "dnf") pts += DNF;

  if (r.fastestLap && r.finishPosition && r.finishPosition <= 10)
    pts += FASTEST_LAP;
  if (r.dotd) pts += DRIVER_OF_THE_DAY;

  if (r.gridPosition && r.finishPosition && r.status === "finished") {
    const delta = r.gridPosition - r.finishPosition;
    if (delta > 0)
      pts += Math.min(delta, POSITIONS_GAINED_CAP) * POSITIONS_GAINED_PER;
    else pts += Math.max(delta, -POSITIONS_GAINED_CAP) * Math.abs(POSITIONS_LOST_PER);
  }

  if (teammateNumber != null) {
    const tm = sess.results.find((x) => x.driverNumber === teammateNumber);
    if (tm) {
      if (
        r.qualiPosition &&
        tm.qualiPosition &&
        r.qualiPosition < tm.qualiPosition
      )
        pts += BEAT_TEAMMATE_QUALI;
      if (
        r.finishPosition &&
        tm.finishPosition &&
        r.finishPosition < tm.finishPosition &&
        r.status === "finished"
      )
        pts += BEAT_TEAMMATE_RACE;
    }
  }

  if (sess.hasSprint && sess.sprintResults) {
    const s = sess.sprintResults.find((x) => x.driverNumber === driverNumber);
    if (s && s.finishPosition && s.finishPosition >= 1)
      pts += SPRINT_POINTS[s.finishPosition - 1] ?? 0;
  }

  return pts;
}

export function scoreConstructorWeekend(
  driverNumbers: number[],
  sess: SessionScoring,
): number {
  // Constructor scores from both cars combined. We score each driver
  // (no teammate bonus, since both are the constructor's own).
  let pts = 0;
  for (const n of driverNumbers) {
    pts += scoreDriverWeekend(n, sess, null);
  }
  return pts;
}
