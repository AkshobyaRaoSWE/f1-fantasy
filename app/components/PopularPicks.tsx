"use client";

import { useMemo, useState } from "react";
import {
  BUDGET_CAP,
  CONSTRUCTORS,
  DRIVERS,
  constructorById,
  type ConstructorId,
} from "../lib/data";
import type { Projections } from "../lib/form";
import { optimize } from "../lib/optimizer";

type Tally = {
  key: string;
  label: string;
  team?: string;
  teamColor?: string;
  color: string;
  count: number;
  pct: number;
  captainCount: number;
  avgProj: number;
  price: number;
  kind: "driver" | "constructor";
};

export function PopularPicks({ proj }: { proj: Projections }) {
  const [budget, setBudget] = useState(BUDGET_CAP);

  const { driverTallies, conTallies, totalRuns } = useMemo(() => {
    const driverMap = new Map<number, { count: number; capCount: number }>();
    const conMap = new Map<ConstructorId, { count: number }>();

    const variants: { k: string; opts: Parameters<typeof optimize>[1] }[] = [];
    // Baseline
    variants.push({ k: "base", opts: { budget, topK: 1 } });

    // Lock each driver one at a time
    for (const dp of proj.drivers) {
      variants.push({
        k: `lock-d${dp.driver.number}`,
        opts: { budget, topK: 1, lockDrivers: [dp.driver.number] },
      });
    }
    // Lock each constructor
    for (const cp of proj.constructors) {
      variants.push({
        k: `lock-c${cp.constructor.id}`,
        opts: { budget, topK: 1, lockConstructors: [cp.constructor.id] },
      });
    }
    // Exclude each top-5 driver to see depth
    for (const dp of proj.drivers.slice(0, 5)) {
      variants.push({
        k: `ex-d${dp.driver.number}`,
        opts: { budget, topK: 1, excludeDrivers: [dp.driver.number] },
      });
    }
    // Vary budget
    for (const b of [budget - 10, budget - 5, budget + 5]) {
      variants.push({ k: `b${b}`, opts: { budget: b, topK: 1 } });
    }

    let runs = 0;
    for (const v of variants) {
      const out = optimize(proj, v.opts);
      if (out[0]) {
        runs++;
        for (const d of out[0].drivers) {
          const cur = driverMap.get(d.number) ?? { count: 0, capCount: 0 };
          cur.count += 1;
          if (d.number === out[0].drsBoostDriver.number) cur.capCount += 1;
          driverMap.set(d.number, cur);
        }
        for (const c of out[0].constructors) {
          const cur = conMap.get(c.id) ?? { count: 0 };
          cur.count += 1;
          conMap.set(c.id, cur);
        }
      }
    }

    const driverTallies: Tally[] = [...driverMap.entries()]
      .map(([num, v]) => {
        const drv = DRIVERS.find((d) => d.number === num)!;
        const dp = proj.byDriverNumber.get(num)!;
        const team = constructorById(drv.team);
        return {
          key: `d-${num}`,
          label: drv.acronym,
          team: team?.short,
          teamColor: team?.color,
          color: team?.color ?? "#888",
          count: v.count,
          pct: runs > 0 ? (v.count / runs) * 100 : 0,
          captainCount: v.capCount,
          avgProj: dp.weighted,
          price: drv.price,
          kind: "driver" as const,
        };
      })
      .sort((a, b) => b.count - a.count);

    const conTallies: Tally[] = [...conMap.entries()]
      .map(([id, v]) => {
        const con = CONSTRUCTORS.find((c) => c.id === id)!;
        const cp = proj.byConstructorId.get(id)!;
        return {
          key: `c-${id}`,
          label: con.short,
          color: con.color,
          count: v.count,
          pct: runs > 0 ? (v.count / runs) * 100 : 0,
          captainCount: 0,
          avgProj: cp.weighted,
          price: con.price,
          kind: "constructor" as const,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { driverTallies, conTallies, totalRuns: runs };
  }, [proj, budget]);

  return (
    <div className="space-y-6 page-in">
      <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-white/[0.06]">
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
          {totalRuns} optimizer runs swept
        </div>
      </div>

      <div className="text-[12px] text-white/45 leading-relaxed">
        Consensus picks across {totalRuns} constraint variations: baseline, each
        asset locked, top-5 driver excluded, ±$5M budget. Higher % means the
        asset survives in more scenarios — a robust pick.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Drivers" rows={driverTallies} totalRuns={totalRuns} showCaptain />
        <Section title="Constructors" rows={conTallies} totalRuns={totalRuns} />
      </div>

      <div className="text-[11px] text-white/30">
        Note: real top-500 player data needs Official F1 Fantasy API access
        (login required). This is the next-best signal: which assets the
        optimizer keeps even when constraints change.
      </div>
    </div>
  );
}

function Section({
  title,
  rows,
  totalRuns,
  showCaptain,
}: {
  title: string;
  rows: Tally[];
  totalRuns: number;
  showCaptain?: boolean;
}) {
  return (
    <div className="panel">
      <div className="px-5 py-3 border-b border-white/[0.06] text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium">
        {title}
      </div>
      <ul>
        {rows.map((r, i) => (
          <li
            key={r.key}
            className="row-in"
            style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
          >
            <div className="px-5 py-2.5 flex items-center gap-3 border-b border-white/[0.03] last:border-0 row-hover">
              <span className="w-5 text-[11px] mono text-white/35">{i + 1}</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-white">{r.label}</span>
                  {showCaptain && r.captainCount > 0 && (
                    <span className="text-[9px] uppercase tracking-wider text-[#f5a524] font-medium">
                      boost ×{r.captainCount}
                    </span>
                  )}
                </div>
                <div className="mt-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.pct}%`,
                      background: r.color,
                      opacity: 0.8,
                      transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </div>
              </div>
              <div className="text-right w-20">
                <div className="text-[14px] mono font-medium text-white">
                  {r.pct.toFixed(0)}%
                </div>
                <div className="text-[10px] text-white/35 mono">
                  {r.count}/{totalRuns}
                </div>
              </div>
              <div className="text-right w-16">
                <div className="text-[11px] mono text-white/55">
                  ${r.price.toFixed(1)}
                </div>
                <div className="text-[10px] text-[#34d39a] mono">
                  {r.avgProj.toFixed(0)}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
