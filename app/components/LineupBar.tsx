"use client";

import { useMemo } from "react";
import {
  BUDGET_CAP,
  CONSTRUCTORS,
  DRIVERS,
  DRS_BOOST_MULTIPLIER,
  SQUAD_SIZE,
  type ConstructorId,
} from "../lib/data";
import type { Projections } from "../lib/form";
import { DriverChip, ConstructorChip } from "./AssetCard";

export type LineupState = {
  driverNumbers: number[];
  constructorIds: ConstructorId[];
  captainNumber: number | null;
};

export function emptyLineup(): LineupState {
  return { driverNumbers: [], constructorIds: [], captainNumber: null };
}

export function lineupCost(s: LineupState): number {
  let c = 0;
  for (const n of s.driverNumbers) {
    const d = DRIVERS.find((x) => x.number === n);
    if (d) c += d.price;
  }
  for (const id of s.constructorIds) {
    const k = CONSTRUCTORS.find((x) => x.id === id);
    if (k) c += k.price;
  }
  return c;
}

export function lineupProjected(s: LineupState, proj: Projections): number {
  let p = 0;
  for (const n of s.driverNumbers) {
    const dp = proj.byDriverNumber.get(n);
    if (dp) p += dp.weighted;
  }
  for (const id of s.constructorIds) {
    const cp = proj.byConstructorId.get(id);
    if (cp) p += cp.weighted;
  }
  if (s.captainNumber != null) {
    const dp = proj.byDriverNumber.get(s.captainNumber);
    if (dp) p += dp.weighted * (DRS_BOOST_MULTIPLIER - 1);
  }
  return p;
}

export function LineupBar({
  state,
  setState,
  proj,
  budget = BUDGET_CAP,
}: {
  state: LineupState;
  setState: (s: LineupState) => void;
  proj: Projections;
  budget?: number;
}) {
  const cost = useMemo(() => lineupCost(state), [state]);
  const projected = useMemo(
    () => lineupProjected(state, proj),
    [state, proj],
  );
  const remaining = budget - cost;
  const overBudget = cost > budget;

  const driverObjs = state.driverNumbers
    .map((n) => DRIVERS.find((x) => x.number === n))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const conObjs = state.constructorIds
    .map((id) => CONSTRUCTORS.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => !!x);

  const slotsLeftDrivers = SQUAD_SIZE.drivers - driverObjs.length;
  const slotsLeftCon = SQUAD_SIZE.constructors - conObjs.length;

  return (
    <div className="bg-gradient-to-r from-zinc-950 to-black border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
            Drivers
          </span>
          {driverObjs.map((d) => (
            <button
              key={d.number}
              onClick={() =>
                setState({
                  ...state,
                  driverNumbers: state.driverNumbers.filter(
                    (n) => n !== d.number,
                  ),
                  captainNumber:
                    state.captainNumber === d.number
                      ? null
                      : state.captainNumber,
                })
              }
              title="Click to remove"
              className={`relative ${
                state.captainNumber === d.number
                  ? "ring-1 ring-yellow-300 ring-offset-1 ring-offset-black rounded"
                  : ""
              }`}
            >
              <DriverChip d={d} />
            </button>
          ))}
          {Array.from({ length: slotsLeftDrivers }).map((_, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[11px] font-display tracking-wide border border-dashed border-white/15 text-white/25"
            >
              empty
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
            Teams
          </span>
          {conObjs.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setState({
                  ...state,
                  constructorIds: state.constructorIds.filter((x) => x !== c.id),
                })
              }
              title="Click to remove"
            >
              <ConstructorChip c={c} />
            </button>
          ))}
          {Array.from({ length: slotsLeftCon }).map((_, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[11px] font-display tracking-wide border border-dashed border-white/15 text-white/25"
            >
              empty
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-5">
          <Meter
            label="Cost"
            value={`$${cost.toFixed(1)}`}
            sub={`/ $${budget.toFixed(0)}`}
            danger={overBudget}
          />
          <Meter
            label="Left"
            value={`$${remaining.toFixed(1)}`}
            danger={overBudget}
            good={!overBudget && remaining < 5}
          />
          <Meter
            label="Projected"
            value={projected.toFixed(1)}
            sub="pts"
            big
          />
          <button
            onClick={() => setState(emptyLineup())}
            className="text-[10px] font-display tracking-[0.2em] uppercase text-white/40 hover:text-white/80 transition"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  sub,
  danger,
  good,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  good?: boolean;
  big?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-[9px] font-display tracking-[0.3em] uppercase text-white/40">
        {label}
      </div>
      <div
        className={`font-display tabular-nums ${big ? "text-xl" : "text-base"} ${
          danger ? "text-red-400" : good ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
        {sub && <span className="text-white/30 text-xs ml-1">{sub}</span>}
      </div>
    </div>
  );
}
