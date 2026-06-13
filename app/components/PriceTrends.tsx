"use client";

import { useMemo, useState } from "react";
import { constructorById } from "../lib/data";
import type { Projections } from "../lib/form";

// ────────────────────────────────────────────────────────────────────
// Realistic price-move model
//
// F1 Fantasy prices move in increments of $0.1M, capped near ±$0.3M per
// race in the vast majority of cases. The official formula uses ownership
// + comparative score, which we don't have access to. We approximate it as:
//
//   expected_per_race(price)  = price * 1.0   (1 pt per $M, derived from
//                                              top drivers averaging ~25 pts at $25M)
//   3-race-rolling average needs to exceed (expected + ε) to trigger a
//   price rise, or fall below (expected − ε) to trigger a fall.
//
//   ε thresholds (asymmetric — falling is harder than rising in real game):
//     +$0.3M  → +5 pts above expected
//     +$0.1M  → 0 pts (at-expected)
//     −$0.1M  → −5 pts below
//     −$0.3M  → −10 pts below
//
//   For each asset, given last 2 race scores (r1, r2) and a target delta,
//   the points needed in the next race is:
//     needed = 3 * (expected + ε(delta)) − r1 − r2
//
// We cap displayed values at ±60 (anything beyond that is shown as
// "≤" / "≥" with the boundary). Constructor expected score uses 2× since
// they're scored from two cars combined.
// ────────────────────────────────────────────────────────────────────

const TIER_THRESHOLDS_DRIVER: Record<number, number> = {
  [-0.3]: -10,
  [-0.1]: -5,
  [0.1]: 0,
  [0.3]: 5,
};
const TIER_THRESHOLDS_CONSTRUCTOR: Record<number, number> = {
  [-0.3]: -18,
  [-0.1]: -8,
  [0.1]: 0,
  [0.3]: 8,
};

// Tier dividing line for grouping
const PRICE_TIER_BREAK_DRIVER = 18.5;
const PRICE_TIER_BREAK_CONSTRUCTOR = 18.5;

type TierMode = "T1" | "T2" | "T3";

const TIER_DELTAS: Record<TierMode, number[]> = {
  T1: [-0.1, 0.1],
  T2: [-0.3, -0.1, 0.1, 0.3],
  T3: [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5],
};

function expectedDriver(price: number): number {
  return price * 1.0;
}
function expectedConstructor(price: number): number {
  return price * 2.0;
}

function pointsNeeded(
  delta: number,
  expected: number,
  r1: number,
  r2: number,
  isConstructor: boolean,
): number {
  const map = isConstructor ? TIER_THRESHOLDS_CONSTRUCTOR : TIER_THRESHOLDS_DRIVER;
  // Interpolate for non-standard deltas like ±0.5
  let eps: number;
  if (map[delta] != null) eps = map[delta];
  else {
    // linear interp from existing keys
    eps = (delta / 0.3) * (isConstructor ? 8 : 5);
  }
  return 3 * (expected + eps) - r1 - r2;
}

// Format the number with bound prefix
function formatNeeded(needed: number, delta: number): string {
  // For negative deltas (falling), the asset needs to score AT MOST `needed` pts
  // For positive deltas (rising), the asset needs to score AT LEAST `needed` pts
  const rounded = Math.round(needed);
  if (delta < 0) {
    if (rounded < -60) return "≤ -60";
    return `≤ ${rounded}`;
  } else {
    if (rounded > 60) return "≥ 60";
    return `${rounded > 0 ? "≥ " : ""}${rounded}`;
  }
}

// Color a cell based on how realistic the threshold is.
// For the negative-delta side: a very-negative threshold means "impossible to
// fall this round" (good if you own the asset) → dark green.
// For the positive-delta side: a low (or negative) threshold means "easy to
// rise" → green; high threshold means "hard to rise" → red.
function cellColor(needed: number, delta: number): string {
  // Map needed-pts onto a 0..1 difficulty, clamped
  // 0 pts = trivial, 50+ pts = near impossible
  let difficulty: number;
  if (delta < 0) {
    // Falling: difficulty of ACHIEVING the fall = how high `needed` is
    // (since "≤ needed" is harder when needed is high)
    // negative needed = easy to avoid (good) → low difficulty
    difficulty = (needed + 30) / 60; // -30 → 0, 30 → 1
  } else {
    // Rising: difficulty of ACHIEVING the rise
    // low needed = easy → low difficulty
    difficulty = needed / 50; // 0 pts → 0, 50 pts → 1
  }
  difficulty = Math.max(0, Math.min(1, difficulty));

  // For negative deltas, "high difficulty" means asset is in DANGER (will fall) → red
  // For positive deltas, "high difficulty" means asset WON'T rise → red (relative to owner who wants the rise)
  // Either way, high difficulty = red, low = green from the asset-holder POV
  // (Owners want negatives to be hard-to-trigger and positives to be easy-to-trigger)
  const palette = [
    { d: 0.0, bg: "#0a3a23", fg: "#34d39a" }, // dark green
    { d: 0.25, bg: "#0c4a2c", fg: "#86efac" },
    { d: 0.5, bg: "#3a3010", fg: "#fbbf24" },
    { d: 0.75, bg: "#5c1f24", fg: "#f87171" },
    { d: 1.0, bg: "#3a0a0e", fg: "#dc2626" }, // dark red
  ];
  // For negative deltas: invert (higher difficulty = closer to falling = red)
  // For positive deltas: difficulty already aligned (high = unlikely to rise = red)
  const idx = Math.min(palette.length - 1, Math.floor(difficulty * palette.length));
  return `bg:${palette[idx].bg};fg:${palette[idx].fg}`;
}

function parseColor(s: string): { bg: string; fg: string } {
  const parts = s.split(";");
  const bg = parts[0].split(":")[1];
  const fg = parts[1].split(":")[1];
  return { bg, fg };
}

function isLightColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

// ────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────

export function PriceTrends({ proj }: { proj: Projections }) {
  const [tierMode, setTierMode] = useState<TierMode>("T2");
  const [driverQ, setDriverQ] = useState("");
  const [conQ, setConQ] = useState("");

  const recent = useMemo(() => {
    const n = proj.rounds.length;
    return {
      r1: proj.rounds[n - 2] ?? null,
      r2: proj.rounds[n - 1] ?? null,
      r1Label: proj.rounds[n - 2]?.round ?? "—",
      r2Label: proj.rounds[n - 1]?.round ?? "—",
    };
  }, [proj.rounds]);

  const deltas = TIER_DELTAS[tierMode];

  const driversFiltered = useMemo(() => {
    const ql = driverQ.toLowerCase();
    return proj.drivers.filter((p) => {
      if (!ql) return true;
      return (
        p.driver.acronym.toLowerCase().includes(ql) ||
        p.driver.name.toLowerCase().includes(ql)
      );
    });
  }, [proj.drivers, driverQ]);

  const constructorsFiltered = useMemo(() => {
    const ql = conQ.toLowerCase();
    return proj.constructors.filter((p) => {
      if (!ql) return true;
      return (
        p.constructor.short.toLowerCase().includes(ql) ||
        p.constructor.name.toLowerCase().includes(ql)
      );
    });
  }, [proj.constructors, conQ]);

  const driverTierA = driversFiltered.filter(
    (p) => p.driver.price >= PRICE_TIER_BREAK_DRIVER,
  );
  const driverTierB = driversFiltered.filter(
    (p) => p.driver.price < PRICE_TIER_BREAK_DRIVER,
  );
  const conTierA = constructorsFiltered.filter(
    (p) => p.constructor.price >= PRICE_TIER_BREAK_CONSTRUCTOR,
  );
  const conTierB = constructorsFiltered.filter(
    (p) => p.constructor.price < PRICE_TIER_BREAK_CONSTRUCTOR,
  );

  return (
    <div className="space-y-8 page-in">
      <div className="text-center pt-4">
        <h1 className="text-[64px] font-bold tracking-[-0.02em] text-white leading-none">
          Budget Builder
        </h1>
        <p className="mt-6 text-[13px] text-white/45 leading-relaxed max-w-md mx-auto">
          Use the points scored in the past two races to see how many points
          each asset needs to score next round to move price by how much. Real
          F1 Fantasy moves are capped near ±$0.3M per race.
        </p>
      </div>

      <div className="flex justify-center">
        <div className="flex items-center gap-2 panel px-3 py-2 rounded-full">
          <InfoIcon />
          <div className="px-3 py-1 text-[12px] text-white/65 border-r border-white/10 mr-2">
            Required Points
          </div>
          <div className="flex gap-1">
            {(["T1", "T2", "T3"] as TierMode[]).map((t) => (
              <button
                key={t}
                onClick={() => setTierMode(t)}
                className={`btn px-3 py-1 text-[11px] mono rounded-md transition ${
                  tierMode === t
                    ? "bg-white/[0.1] text-white"
                    : "text-white/45 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="btn-ghost btn ml-1 w-7 h-7 rounded-md text-white/40 hover:text-white">
            <CogIcon />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1100px] mx-auto px-2">
        <div className="space-y-3">
          <SearchInput
            value={driverQ}
            onChange={setDriverQ}
            placeholder="Find a driver…"
            example="(e.g. VER+NOR)"
          />
          <TierTable
            label="Tier A"
            sublabel={`(≥${PRICE_TIER_BREAK_DRIVER}M)`}
            kind="driver"
            rows={driverTierA}
            r1={recent.r1?.round ?? null}
            r2={recent.r2?.round ?? null}
            deltas={deltas}
            getRecent={(p) => getDriverRecent(p, recent)}
          />
          <TierTable
            label="Tier B"
            sublabel={`(<${PRICE_TIER_BREAK_DRIVER}M)`}
            kind="driver"
            rows={driverTierB}
            r1={recent.r1?.round ?? null}
            r2={recent.r2?.round ?? null}
            deltas={deltas}
            getRecent={(p) => getDriverRecent(p, recent)}
          />
        </div>

        <div className="space-y-3">
          <SearchInput
            value={conQ}
            onChange={setConQ}
            placeholder="Find a constructor…"
            example="(e.g. RED+MCL)"
          />
          <TierTable
            label="Tier A"
            sublabel={`(≥${PRICE_TIER_BREAK_CONSTRUCTOR}M)`}
            kind="constructor"
            rows={conTierA}
            r1={recent.r1?.round ?? null}
            r2={recent.r2?.round ?? null}
            deltas={deltas}
            getRecent={(p) => getConRecent(p, recent)}
          />
          <TierTable
            label="Tier B"
            sublabel={`(<${PRICE_TIER_BREAK_CONSTRUCTOR}M)`}
            kind="constructor"
            rows={conTierB}
            r1={recent.r1?.round ?? null}
            r2={recent.r2?.round ?? null}
            deltas={deltas}
            getRecent={(p) => getConRecent(p, recent)}
          />
        </div>
      </div>

      <div className="text-[11px] text-white/30 text-center max-w-md mx-auto pt-2">
        Note: F1 Fantasy&apos;s real price formula uses ownership delta + score
        vs. peer bracket — neither of which is in any public API. Cells here
        use a 3-race-rolling-average proxy. Direction is usually right;
        magnitudes are best-effort.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// TierTable
// ────────────────────────────────────────────────────────────────────

type Recent = { r1: number; r2: number };

function getDriverRecent(
  p: import("../lib/form").DriverProjection,
  recent: { r1Label: number | string; r2Label: number | string },
): Recent {
  const r1 =
    p.history.find((h) => h.round === recent.r1Label)?.points ?? 0;
  const r2 =
    p.history.find((h) => h.round === recent.r2Label)?.points ?? 0;
  return { r1, r2 };
}

function getConRecent(
  p: import("../lib/form").ConstructorProjection,
  recent: { r1Label: number | string; r2Label: number | string },
): Recent {
  const r1 =
    p.history.find((h) => h.round === recent.r1Label)?.points ?? 0;
  const r2 =
    p.history.find((h) => h.round === recent.r2Label)?.points ?? 0;
  return { r1, r2 };
}

type TierTableProps = {
  label: string;
  sublabel: string;
  kind: "driver" | "constructor";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  r1: number | null;
  r2: number | null;
  deltas: number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRecent: (p: any) => Recent;
};

function TierTable({
  label,
  sublabel,
  kind,
  rows,
  r1,
  r2,
  deltas,
  getRecent,
}: TierTableProps) {
  if (rows.length === 0) return null;
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            {/* Top row: tier label + R3/R4 + colored delta tier headers */}
            <tr>
              <th
                colSpan={3}
                className="px-2 py-2 text-left text-[11px] font-medium text-white"
              >
                <div>{label}</div>
                <div className="text-[9px] text-white/35 font-normal mono">
                  {sublabel}
                </div>
              </th>
              <th className="px-1 py-1 text-center text-[10px] mono text-white/55 bg-white/[0.02]">
                R{r1 ?? "?"}
              </th>
              <th className="px-1 py-1 text-center text-[10px] mono text-white/55 bg-white/[0.02]">
                R{r2 ?? "?"}
              </th>
              {deltas.map((d) => (
                <th
                  key={d}
                  className="px-1 py-1 text-center text-[10px] mono font-semibold"
                  style={{
                    background:
                      d > 0
                        ? d >= 0.3
                          ? "#0c4a2c"
                          : "#0a3a23"
                        : d <= -0.3
                        ? "#3a0a0e"
                        : "#5c1f24",
                    color: d > 0 ? "#86efac" : "#fda4af",
                  }}
                >
                  {d > 0 ? "+" : ""}
                  {d.toFixed(1)}
                </th>
              ))}
            </tr>
            {/* Sub-header: column labels */}
            <tr className="border-b border-white/[0.06]">
              <th className="px-2 py-1 text-left text-[9px] uppercase tracking-wider text-white/35 font-medium">
                {kind === "driver" ? "DR" : "CR"}
              </th>
              <th className="px-2 py-1 text-center text-[9px] uppercase tracking-wider text-white/35 font-medium">
                $
              </th>
              <th />
              <th className="px-1 py-1 text-center text-[9px] uppercase tracking-wider text-white/35 font-medium">
                Pts
              </th>
              <th className="px-1 py-1 text-center text-[9px] uppercase tracking-wider text-white/35 font-medium">
                Pts
              </th>
              {deltas.map((d) => (
                <th
                  key={`pts-${d}`}
                  className="px-1 py-1 text-center text-[9px] uppercase tracking-wider text-white/35 font-medium"
                >
                  Pts
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const isCon = kind === "constructor";
              const item = isCon ? p.constructor : p.driver;
              const code = isCon ? item.short : item.acronym;
              const price = item.price;
              const team = isCon ? item : constructorById(item.team);
              const color = team?.color ?? "#888";
              const recent = getRecent(p);
              const expected = isCon
                ? expectedConstructor(price)
                : expectedDriver(price);
              return (
                <tr
                  key={isCon ? item.id : item.number}
                  className="border-b border-white/[0.03] last:border-0 row-in"
                  style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
                >
                  <td className="px-2 py-1.5">
                    <CodeChip code={code} color={color} />
                  </td>
                  <td className="px-2 py-1.5 text-center mono text-white/85 text-[12px]">
                    {price.toFixed(1)}
                  </td>
                  <td />
                  <td className="px-1 py-1.5 text-center mono text-white/75 bg-white/[0.015]">
                    {recent.r1.toFixed(0)}
                  </td>
                  <td className="px-1 py-1.5 text-center mono text-white/75 bg-white/[0.015]">
                    {recent.r2.toFixed(0)}
                  </td>
                  {deltas.map((d) => {
                    const needed = pointsNeeded(
                      d,
                      expected,
                      recent.r1,
                      recent.r2,
                      isCon,
                    );
                    const colorStr = cellColor(needed, d);
                    const c = parseColor(colorStr);
                    return (
                      <td
                        key={d}
                        className="px-1 py-1.5 text-center mono font-medium"
                        style={{ background: c.bg, color: c.fg }}
                        title={
                          d > 0
                            ? `Needs to score ${formatNeeded(needed, d)} pts next race for +$${d.toFixed(1)}M move`
                            : `Would need to score ${formatNeeded(needed, d)} pts next race for −$${Math.abs(d).toFixed(1)}M move`
                        }
                      >
                        {formatNeeded(needed, d)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Reusable bits
// ────────────────────────────────────────────────────────────────────

function CodeChip({ code, color }: { code: string; color: string }) {
  const lightBg = isLightColor(color);
  return (
    <span
      className="inline-block px-2 py-1 rounded font-display text-[11px] leading-none border"
      style={{
        background: color,
        color: lightBg ? "#0b0b0d" : "#fff",
        borderColor: color,
      }}
    >
      {code}
    </span>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  example,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
  example: string;
}) {
  return (
    <div className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input w-full text-[12px] pr-24"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/30 pointer-events-none">
        {example}
      </span>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="text-white/40"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8h0" strokeLinecap="round" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.6a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.6a7 7 0 002-1.2l2.3 1 2-3.4-2-1.6a7 7 0 00.1-1.2z" />
    </svg>
  );
}
