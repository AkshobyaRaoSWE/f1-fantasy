"use client";

import { useMemo } from "react";
import type { Projections } from "../lib/form";
import {
  CONSTRUCTORS,
  DRIVERS,
  constructorById,
  type Constructor,
  type Driver,
} from "../lib/data";
import { suggestTransfers, type TransferSuggestion } from "../lib/optimizer";
import {
  lineupCost,
  lineupProjected,
  type LineupState,
} from "./LineupBar";

export function Transfers({
  proj,
  state,
  setState,
}: {
  proj: Projections;
  state: LineupState;
  setState: (s: LineupState) => void;
}) {
  const drivers: Driver[] = state.driverNumbers
    .map((n) => DRIVERS.find((d) => d.number === n))
    .filter((x): x is Driver => !!x);
  const cons: Constructor[] = state.constructorIds
    .map((id) => CONSTRUCTORS.find((c) => c.id === id))
    .filter((x): x is Constructor => !!x);

  const suggestions: TransferSuggestion[] = useMemo(() => {
    if (drivers.length + cons.length === 0) return [];
    return suggestTransfers({ drivers, constructors: cons }, proj, undefined, 25);
  }, [drivers, cons, proj]);

  const cost = lineupCost(state);
  const projected = lineupProjected(state, proj);

  if (drivers.length + cons.length === 0) {
    return (
      <div className="py-12 text-center text-white/35 text-[13px]">
        Build a lineup first on the Pick Team tab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6 pb-4 border-b border-white/[0.06]">
        <Stat label="Current cost" value={`$${cost.toFixed(1)}M`} />
        <Stat label="Current projected" value={projected.toFixed(1)} accent />
        <Stat label="Suggestions" value={suggestions.length.toString()} />
      </div>

      {suggestions.length === 0 ? (
        <div className="p-10 text-center text-white/35 text-[13px] border border-dashed border-white/[0.08] rounded-lg">
          No improving swap exists at this budget.
        </div>
      ) : (
        <div className="panel">
          <table className="w-full text-[13px]">
            <thead className="border-b border-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">Drop</th>
                <th className="w-8" />
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">Add</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">Cost Δ</th>
                <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">Proj Δ</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s, i) => (
                <SwapRow
                  key={i}
                  s={s}
                  onApply={() => apply(s)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  function apply(s: TransferSuggestion) {
    let next: LineupState = { ...state };
    if (s.outDriver && s.inDriver) {
      next = {
        ...next,
        driverNumbers: next.driverNumbers.map((n) =>
          n === s.outDriver!.number ? s.inDriver!.number : n,
        ),
        captainNumber:
          next.captainNumber === s.outDriver.number
            ? s.inDriver.number
            : next.captainNumber,
      };
    }
    if (s.outConstructor && s.inConstructor) {
      next = {
        ...next,
        constructorIds: next.constructorIds.map((id) =>
          id === s.outConstructor!.id ? s.inConstructor!.id : id,
        ),
      };
    }
    setState(next);
  }
}

function SwapRow({
  s,
  onApply,
}: {
  s: TransferSuggestion;
  onApply: () => void;
}) {
  const out = s.outDriver
    ? { label: s.outDriver.acronym, color: constructorById(s.outDriver.team)?.color, sub: s.outDriver.name }
    : { label: s.outConstructor!.short, color: s.outConstructor!.color, sub: s.outConstructor!.name };
  const inn = s.inDriver
    ? { label: s.inDriver.acronym, color: constructorById(s.inDriver.team)?.color, sub: s.inDriver.name }
    : { label: s.inConstructor!.short, color: s.inConstructor!.color, sub: s.inConstructor!.name };

  return (
    <tr className="border-b border-white/[0.03] last:border-0 row-hover cursor-pointer" onClick={onApply}>
      <td className="px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: out.color }} />
          <span className="font-medium text-white">{out.label}</span>
          <span className="text-[11px] text-white/40 truncate max-w-[140px]">{out.sub}</span>
        </div>
      </td>
      <td className="text-center text-white/30">→</td>
      <td className="px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: inn.color }} />
          <span className="font-medium text-white">{inn.label}</span>
          <span className="text-[11px] text-white/40 truncate max-w-[140px]">{inn.sub}</span>
        </div>
      </td>
      <td className={`px-3 py-2.5 text-right mono ${s.costDelta > 0 ? "text-[#ef4444]/80" : "text-[#34d39a]/80"}`}>
        {s.costDelta >= 0 ? "+" : ""}${s.costDelta.toFixed(1)}
      </td>
      <td className="px-3 py-2.5 text-right mono text-[#34d39a] font-medium">
        +{s.projectedDelta.toFixed(1)}
      </td>
      <td className="pr-4 py-2.5 text-right">
        <span className="text-[11px] text-white/45">click row →</span>
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mb-1">
        {label}
      </div>
      <div className={`text-[22px] font-semibold mono leading-none ${accent ? "text-[#34d39a]" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
