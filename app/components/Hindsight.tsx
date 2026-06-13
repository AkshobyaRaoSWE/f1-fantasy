"use client";

import { useMemo, useState } from "react";
import { BUDGET_CAP, constructorById } from "../lib/data";
import type { Projections } from "../lib/form";
import { hindsightForRound, type HindsightLineup } from "../lib/optimizer";

export function Hindsight({ proj }: { proj: Projections }) {
  const [budget, setBudget] = useState(BUDGET_CAP);

  const items: HindsightLineup[] = useMemo(() => {
    const out: HindsightLineup[] = [];
    for (const r of proj.rounds) {
      const h = hindsightForRound(proj, r.round, budget);
      if (h) out.push(h);
    }
    out.sort((a, b) => b.round - a.round);
    return out;
  }, [proj, budget]);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mb-1.5">
            Budget cap
          </label>
          <div className="relative inline-block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[13px]">$</span>
            <input
              type="number"
              step="0.5"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-32 bg-transparent border border-white/10 rounded-md pl-6 pr-9 py-2 text-white mono focus:outline-none focus:border-white/30 text-[15px]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-[11px]">M</span>
          </div>
        </div>
        <div className="ml-auto text-[11px] text-white/35 mono">
          {items.length} round{items.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((h) => (
          <RoundPanel key={h.round} h={h} />
        ))}
        {items.length === 0 && (
          <div className="p-10 text-center text-white/35 text-[13px] border border-dashed border-white/[0.08] rounded-lg">
            No completed rounds in form data yet.
          </div>
        )}
      </div>
    </div>
  );
}

function RoundPanel({ h }: { h: HindsightLineup }) {
  const l = h.best;
  return (
    <div className="panel">
      <div className="flex items-baseline justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mono">
            R{h.round}
          </span>
          <span className="font-medium text-white text-[15px]">{h.raceName}</span>
        </div>
        <div className="text-right">
          <span className="text-[28px] font-semibold mono text-[#34d39a] leading-none">
            {l.projected.toFixed(0)}
          </span>
          <span className="text-[11px] text-white/35 ml-2">pts max</span>
        </div>
      </div>
      <div className="px-5 py-3 flex flex-wrap items-center gap-2 text-[12px]">
        {l.drivers.map((d) => {
          const isCap = d.number === l.drsBoostDriver.number;
          const team = constructorById(d.team);
          return (
            <span
              key={d.number}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${
                isCap ? "bg-[#f5a524]/15 text-[#f5a524] font-medium" : "text-white/80"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: team?.color }} />
              {d.acronym}
              {isCap && <span className="text-[9px] tracking-wider ml-1">BOOST</span>}
            </span>
          );
        })}
        <span className="text-white/20 mx-1.5">|</span>
        {l.constructors.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-white/65">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.short}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-white/40 mono">
          ${l.cost.toFixed(1)}M
        </span>
      </div>
    </div>
  );
}
