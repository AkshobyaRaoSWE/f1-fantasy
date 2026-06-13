"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUDGET_CAP,
  CONSTRUCTORS,
  DRIVERS,
  DRS_BOOST_MULTIPLIER,
  constructorById,
  type ConstructorId,
} from "../lib/data";
import type { Projections } from "../lib/form";
import { optimize, type Lineup } from "../lib/optimizer";
import type { LineupState } from "./LineupBar";

type Chip = "none" | "X3" | "LL" | "WC" | "NN" | "AP";

const CHIPS: { id: Chip; label: string; full: string; affects: boolean }[] = [
  { id: "X3", label: "X3", full: "Triple boost (×3 captain)",            affects: true  },
  { id: "LL", label: "LL", full: "Limitless (no budget cap)",            affects: true  },
  { id: "WC", label: "WC", full: "Wildcard (free transfers, no effect on pick)", affects: false },
  { id: "NN", label: "NN", full: "No negative (negative scores → 0)",    affects: true  },
  { id: "AP", label: "AP", full: "Auto pilot (uses Limitless logic)",    affects: true  },
];

export function Optimizer({
  proj,
  setLineup,
}: {
  proj: Projections;
  setLineup: (s: LineupState) => void;
}) {
  const [budget, setBudget] = useState(BUDGET_CAP);
  const [chip, setChip] = useState<Chip>("none");
  const [convertPriceMove, setConvertPriceMove] = useState(false);
  const [lockDrivers, setLockDrivers] = useState<Set<number>>(new Set());
  const [excludeDrivers, setExcludeDrivers] = useState<Set<number>>(new Set());
  const [lockConstructors, setLockConstructors] = useState<Set<ConstructorId>>(
    new Set(),
  );
  const [excludeConstructors, setExcludeConstructors] = useState<Set<ConstructorId>>(
    new Set(),
  );
  const [driverQ, setDriverQ] = useState("");
  const [conQ, setConQ] = useState("");
  const [driverSort, setDriverSort] = useState<"xPts" | "price" | "delta">("xPts");
  const [conSort, setConSort] = useState<"xPts" | "price" | "delta">("xPts");

  // Apply chip effects
  const effectiveBudget = chip === "LL" || chip === "AP" ? 1000 : budget;
  const boostMult = chip === "X3" ? 3 : DRS_BOOST_MULTIPLIER;
  const clampNegative = chip === "NN";

  const adjustedProj = useMemo<Projections>(() => {
    if (!clampNegative) return proj;
    const drivers = proj.drivers.map((dp) => ({
      ...dp,
      weighted: Math.max(0, dp.weighted),
      avg: Math.max(0, dp.avg),
    }));
    const constructors = proj.constructors.map((cp) => ({
      ...cp,
      weighted: Math.max(0, cp.weighted),
      avg: Math.max(0, cp.avg),
    }));
    drivers.sort((a, b) => b.weighted - a.weighted);
    constructors.sort((a, b) => b.weighted - a.weighted);
    return {
      ...proj,
      drivers,
      constructors,
      byDriverNumber: new Map(drivers.map((p) => [p.driver.number, p])),
      byConstructorId: new Map(constructors.map((p) => [p.constructor.id, p])),
    };
  }, [proj, clampNegative]);

  // Per-asset expected price move
  const priceMoves = useMemo(() => buildPriceMoves(adjustedProj), [adjustedProj]);

  // If converting price moves, add weighted delta into projection sort
  const sortedProj = useMemo<Projections>(() => {
    if (!convertPriceMove) return adjustedProj;
    const drivers = adjustedProj.drivers.map((dp) => ({
      ...dp,
      weighted: dp.weighted + (priceMoves.driver.get(dp.driver.number) ?? 0) * 5,
    }));
    const constructors = adjustedProj.constructors.map((cp) => ({
      ...cp,
      weighted: cp.weighted + (priceMoves.con.get(cp.constructor.id) ?? 0) * 5,
    }));
    drivers.sort((a, b) => b.weighted - a.weighted);
    constructors.sort((a, b) => b.weighted - a.weighted);
    return {
      ...adjustedProj,
      drivers,
      constructors,
      byDriverNumber: new Map(drivers.map((p) => [p.driver.number, p])),
      byConstructorId: new Map(constructors.map((p) => [p.constructor.id, p])),
    };
  }, [adjustedProj, convertPriceMove, priceMoves]);

  const lineups: Lineup[] = useMemo(() => {
    return optimize(sortedProj, {
      budget: effectiveBudget,
      topK: 25,
      lockDrivers: [...lockDrivers],
      lockConstructors: [...lockConstructors],
      excludeDrivers: [...excludeDrivers],
      excludeConstructors: [...excludeConstructors],
    }).map((l) => {
      // Recalculate projected with override boost multiplier
      let captain = l.drivers[0];
      let bestExtra = -Infinity;
      for (const d of l.drivers) {
        const w = sortedProj.byDriverNumber.get(d.number)?.weighted ?? 0;
        const extra = w * (boostMult - 1);
        if (extra > bestExtra) {
          bestExtra = extra;
          captain = d;
        }
      }
      return { ...l, drsBoostDriver: captain, boostedDriverGain: bestExtra };
    });
  }, [
    sortedProj,
    effectiveBudget,
    lockDrivers,
    lockConstructors,
    excludeDrivers,
    excludeConstructors,
    boostMult,
  ]);

  function reset() {
    setBudget(BUDGET_CAP);
    setChip("none");
    setConvertPriceMove(false);
    setLockDrivers(new Set());
    setExcludeDrivers(new Set());
    setLockConstructors(new Set());
    setExcludeConstructors(new Set());
  }

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px_300px] gap-4">
        <BestTeamsPanel
          lineups={lineups}
          proj={sortedProj}
          priceMoves={priceMoves}
          boostMult={boostMult}
          onApply={(l) =>
            setLineup({
              driverNumbers: l.drivers.map((d) => d.number),
              constructorIds: l.constructors.map((c) => c.id),
              captainNumber: l.drsBoostDriver.number,
            })
          }
        />

        <div className="space-y-4">
          <SettingsPanel
            budget={budget}
            setBudget={setBudget}
            chip={chip}
            setChip={setChip}
            convertPriceMove={convertPriceMove}
            setConvertPriceMove={setConvertPriceMove}
            onReset={reset}
            disableBudget={chip === "LL" || chip === "AP"}
          />
          <SimulationPanel form={proj} />
        </div>

        <div className="space-y-4">
          <DriversPanel
            proj={sortedProj}
            priceMoves={priceMoves}
            include={lockDrivers}
            exclude={excludeDrivers}
            setInclude={setLockDrivers}
            setExclude={setExcludeDrivers}
            q={driverQ}
            setQ={setDriverQ}
            sort={driverSort}
            setSort={setDriverSort}
          />
          <ConstructorsPanel
            proj={sortedProj}
            priceMoves={priceMoves}
            include={lockConstructors}
            exclude={excludeConstructors}
            setInclude={setLockConstructors}
            setExclude={setExcludeConstructors}
            q={conQ}
            setQ={setConQ}
            sort={conSort}
            setSort={setConSort}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Best Teams panel
// ────────────────────────────────────────────────────────────────────

function BestTeamsPanel({
  lineups,
  proj,
  priceMoves,
  boostMult,
  onApply,
}: {
  lineups: Lineup[];
  proj: Projections;
  priceMoves: PriceMoves;
  boostMult: number;
  onApply: (l: Lineup) => void;
}) {
  return (
    <Panel title="Best Teams" subtitle={`${lineups.length} optimal lineups`}>
      {lineups.length === 0 && (
        <div className="p-10 text-center text-white/35 text-[13px]">
          No lineup fits the constraints.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium w-8">#</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">CR</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">x2</th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">DR</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">$</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">xΔ$</th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">xPts ↓</th>
            </tr>
          </thead>
          <tbody>
            {lineups.map((l, i) => {
              const totalDelta =
                l.drivers.reduce(
                  (s, d) => s + (priceMoves.driver.get(d.number) ?? 0),
                  0,
                ) +
                l.constructors.reduce(
                  (s, c) => s + (priceMoves.con.get(c.id) ?? 0),
                  0,
                );
              return (
                <tr
                  key={i}
                  onClick={() => onApply(l)}
                  className="border-b border-white/[0.04] last:border-0 row-hover row-in cursor-pointer"
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                >
                  <td className="px-3 py-2 mono text-white/45">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {l.constructors.map((c) => {
                        const cp = proj.byConstructorId.get(c.id);
                        return (
                          <AssetTile
                            key={c.id}
                            code={c.short}
                            color={c.color}
                            xPts={cp?.weighted ?? 0}
                            xDelta={priceMoves.con.get(c.id) ?? 0}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const d = l.drsBoostDriver;
                      const team = constructorById(d.team);
                      const dp = proj.byDriverNumber.get(d.number);
                      return (
                        <AssetTile
                          code={d.acronym}
                          color={team?.color ?? "#888"}
                          xPts={(dp?.weighted ?? 0) * boostMult}
                          xDelta={priceMoves.driver.get(d.number) ?? 0}
                          captain
                          captainMult={boostMult}
                        />
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {l.drivers
                        .filter((d) => d.number !== l.drsBoostDriver.number)
                        .map((d) => {
                          const team = constructorById(d.team);
                          const dp = proj.byDriverNumber.get(d.number);
                          return (
                            <AssetTile
                              key={d.number}
                              code={d.acronym}
                              color={team?.color ?? "#888"}
                              xPts={dp?.weighted ?? 0}
                              xDelta={priceMoves.driver.get(d.number) ?? 0}
                            />
                          );
                        })}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right mono text-white/85">
                    {l.cost.toFixed(1)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right mono ${
                      totalDelta > 0.05
                        ? "text-[#34d39a]"
                        : totalDelta < -0.05
                        ? "text-[#ef4444]"
                        : "text-white/40"
                    }`}
                  >
                    {totalDelta >= 0 ? "+" : ""}
                    {totalDelta.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right mono font-medium text-white">
                    {l.projected.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────────
// Asset tile
// ────────────────────────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  // Approx luminance
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

function AssetTile({
  code,
  color,
  xPts,
  xDelta,
  captain,
  captainMult,
}: {
  code: string;
  color: string;
  xPts: number;
  xDelta: number;
  captain?: boolean;
  captainMult?: number;
}) {
  const lightBg = isLightColor(color);
  const textColor = lightBg ? "#0b0b0d" : "#ffffff";
  return (
    <div
      className={`relative w-[58px] rounded-md overflow-hidden card-hover ${
        captain ? "ring-2 ring-[#fbbf24] shadow-[0_0_16px_rgba(251,191,36,0.25)]" : ""
      }`}
    >
      <div
        className="px-1 py-1 text-center font-display text-[12px] tracking-tight leading-none"
        style={{ background: color, color: textColor }}
      >
        {code}
      </div>
      <div className="bg-[#1a1a1f] px-1 py-1 text-center">
        <div className="text-[12px] mono text-white leading-none">
          {xPts.toFixed(1)}
        </div>
        <div
          className={`text-[9px] mono leading-none mt-0.5 ${
            xDelta > 0.02
              ? "text-[#34d39a]"
              : xDelta < -0.02
              ? "text-[#ef4444]"
              : "text-white/40"
          }`}
        >
          {xDelta >= 0 ? "+" : ""}
          {xDelta.toFixed(2)}
        </div>
      </div>
      {captain && (
        <span
          className="absolute -top-1 -right-1 text-[8px] font-semibold px-1 rounded leading-tight"
          style={{ background: "#fbbf24", color: "#0b0b0d" }}
        >
          ×{captainMult}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Settings panel
// ────────────────────────────────────────────────────────────────────

function SettingsPanel({
  budget,
  setBudget,
  chip,
  setChip,
  convertPriceMove,
  setConvertPriceMove,
  onReset,
  disableBudget,
}: {
  budget: number;
  setBudget: (n: number) => void;
  chip: Chip;
  setChip: (c: Chip) => void;
  convertPriceMove: boolean;
  setConvertPriceMove: (b: boolean) => void;
  onReset: () => void;
  disableBudget: boolean;
}) {
  return (
    <Panel title="Settings">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-[11px] text-white/55 mb-1.5">
            Maximum budget
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[13px]">$</span>
            <input
              type="number"
              step="0.5"
              min="50"
              max="200"
              value={budget}
              disabled={disableBudget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full bg-[#0a0a0d] border border-white/10 rounded-md pl-6 pr-9 py-2 text-white mono focus:outline-none focus:border-white/30 text-[14px] disabled:opacity-40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-[11px]">M</span>
          </div>
          {disableBudget && (
            <div className="text-[10px] text-[#fbbf24] mt-1.5">
              Limitless chip active — budget cap removed
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] text-white/55 mb-1.5">
            Select a chip
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => {
              const active = chip === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setChip(active ? "none" : c.id)}
                  title={c.full + (c.affects ? "" : " (display only — no effect on optimization)")}
                  className={`btn px-2.5 py-1.5 text-[11px] mono font-medium rounded-md border transition ${
                    active
                      ? "bg-[#fbbf24] text-[#0b0b0d] border-[#fbbf24]"
                      : "border-white/15 text-white/60 hover:text-white hover:border-white/30"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          {chip !== "none" && (
            <div className="text-[11px] text-white/45 mt-2 leading-snug">
              {CHIPS.find((c) => c.id === chip)?.full}
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 cursor-pointer group">
          <span
            onClick={() => setConvertPriceMove(!convertPriceMove)}
            className={`mt-0.5 w-8 h-4 rounded-full p-0.5 transition flex-shrink-0 ${
              convertPriceMove ? "bg-[#34d39a]" : "bg-white/15"
            }`}
          >
            <span
              className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                convertPriceMove ? "translate-x-4" : ""
              }`}
            />
          </span>
          <span
            onClick={() => setConvertPriceMove(!convertPriceMove)}
            className="text-[11px] text-white/55 leading-snug"
          >
            Convert expected price changes (xΔ$) into expected price-change
            points (xΔ$Pts)
          </span>
        </label>

        <button
          onClick={onReset}
          className="btn w-full py-2 text-[11px] text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-md transition"
        >
          ↺ Full reset
        </button>
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────────
// Simulation panel
// ────────────────────────────────────────────────────────────────────

function SimulationPanel({ form }: { form: Projections }) {
  const lastRound = form.rounds[form.rounds.length - 1];
  return (
    <Panel title="Simulation">
      <div className="p-4 space-y-3 text-[11px]">
        <div>
          <label className="block text-white/55 mb-1.5">Projection model</label>
          <div className="bg-[#0a0a0d] border border-white/10 rounded-md px-3 py-2 text-white mono text-[12px]">
            Recency-weighted form
          </div>
        </div>
        {lastRound && (
          <div className="text-white/45 leading-snug">
            Based on {form.rounds.length} round{form.rounds.length === 1 ? "" : "s"}, most
            recent: <span className="text-white/70">R{lastRound.round} {lastRound.country}</span>
          </div>
        )}
        <div className="text-white/35 text-[10px] leading-snug border-t border-white/[0.06] pt-3">
          Newest round weighted heaviest. Re-bake form via{" "}
          <span className="mono text-white/55">node scripts/fetch-form.mjs</span>
          {" "}after each race.
        </div>
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────────
// Drivers / Constructors include-exclude panels
// ────────────────────────────────────────────────────────────────────

type AssetSort = "xPts" | "price" | "delta";

function DriversPanel({
  proj,
  priceMoves,
  include,
  exclude,
  setInclude,
  setExclude,
  q,
  setQ,
  sort,
  setSort,
}: {
  proj: Projections;
  priceMoves: PriceMoves;
  include: Set<number>;
  exclude: Set<number>;
  setInclude: (s: Set<number>) => void;
  setExclude: (s: Set<number>) => void;
  q: string;
  setQ: (s: string) => void;
  sort: AssetSort;
  setSort: (s: AssetSort) => void;
}) {
  const rows = useMemo(() => {
    let list = proj.drivers.slice();
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.driver.acronym.toLowerCase().includes(ql) ||
          p.driver.name.toLowerCase().includes(ql),
      );
    }
    list.sort((a, b) => {
      if (sort === "price") return b.driver.price - a.driver.price;
      if (sort === "delta")
        return (
          (priceMoves.driver.get(b.driver.number) ?? 0) -
          (priceMoves.driver.get(a.driver.number) ?? 0)
        );
      return b.weighted - a.weighted;
    });
    return list;
  }, [proj.drivers, q, sort, priceMoves]);

  function toggleIncl(n: number) {
    const inc = new Set(include);
    if (inc.has(n)) inc.delete(n);
    else {
      inc.add(n);
      const ex = new Set(exclude);
      ex.delete(n);
      setExclude(ex);
    }
    setInclude(inc);
  }
  function toggleExcl(n: number) {
    const ex = new Set(exclude);
    if (ex.has(n)) ex.delete(n);
    else {
      ex.add(n);
      const inc = new Set(include);
      inc.delete(n);
      setInclude(inc);
    }
    setExclude(ex);
  }

  return (
    <Panel
      title="Drivers"
      subtitle={`${include.size} incl · ${exclude.size} excl`}
    >
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a driver…"
            className="flex-1 bg-[#0a0a0d] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
          <SortPills value={sort} onChange={setSort} />
        </div>
      </div>
      <ListHeader />
      <ul className="max-h-[520px] overflow-y-auto">
        {rows.map((dp, i) => {
          const team = constructorById(dp.driver.team);
          const delta = priceMoves.driver.get(dp.driver.number) ?? 0;
          const inc = include.has(dp.driver.number);
          const exc = exclude.has(dp.driver.number);
          return (
            <li
              key={dp.driver.number}
              className="row-in"
              style={{ animationDelay: `${Math.min(i, 18) * 18}ms` }}
            >
              <AssetRow
                code={dp.driver.acronym}
                color={team?.color ?? "#888"}
                price={dp.driver.price}
                xPts={dp.weighted}
                delta={delta}
                inc={inc}
                exc={exc}
                onIncl={() => toggleIncl(dp.driver.number)}
                onExcl={() => toggleExcl(dp.driver.number)}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ConstructorsPanel({
  proj,
  priceMoves,
  include,
  exclude,
  setInclude,
  setExclude,
  q,
  setQ,
  sort,
  setSort,
}: {
  proj: Projections;
  priceMoves: PriceMoves;
  include: Set<ConstructorId>;
  exclude: Set<ConstructorId>;
  setInclude: (s: Set<ConstructorId>) => void;
  setExclude: (s: Set<ConstructorId>) => void;
  q: string;
  setQ: (s: string) => void;
  sort: AssetSort;
  setSort: (s: AssetSort) => void;
}) {
  const rows = useMemo(() => {
    let list = proj.constructors.slice();
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.constructor.short.toLowerCase().includes(ql) ||
          p.constructor.name.toLowerCase().includes(ql),
      );
    }
    list.sort((a, b) => {
      if (sort === "price") return b.constructor.price - a.constructor.price;
      if (sort === "delta")
        return (
          (priceMoves.con.get(b.constructor.id) ?? 0) -
          (priceMoves.con.get(a.constructor.id) ?? 0)
        );
      return b.weighted - a.weighted;
    });
    return list;
  }, [proj.constructors, q, sort, priceMoves]);

  function toggleIncl(id: ConstructorId) {
    const inc = new Set(include);
    if (inc.has(id)) inc.delete(id);
    else {
      inc.add(id);
      const ex = new Set(exclude);
      ex.delete(id);
      setExclude(ex);
    }
    setInclude(inc);
  }
  function toggleExcl(id: ConstructorId) {
    const ex = new Set(exclude);
    if (ex.has(id)) ex.delete(id);
    else {
      ex.add(id);
      const inc = new Set(include);
      inc.delete(id);
      setInclude(inc);
    }
    setExclude(ex);
  }

  return (
    <Panel
      title="Constructors"
      subtitle={`${include.size} incl · ${exclude.size} excl`}
    >
      <div className="p-3 border-b border-white/[0.06]">
        <div className="flex gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a constructor…"
            className="flex-1 bg-[#0a0a0d] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-white/30 placeholder:text-white/30"
          />
          <SortPills value={sort} onChange={setSort} />
        </div>
      </div>
      <ListHeader />
      <ul>
        {rows.map((cp, i) => {
          const c = cp.constructor;
          const delta = priceMoves.con.get(c.id) ?? 0;
          const inc = include.has(c.id);
          const exc = exclude.has(c.id);
          return (
            <li
              key={c.id}
              className="row-in"
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
            >
              <AssetRow
                code={c.short}
                color={c.color}
                price={c.price}
                xPts={cp.weighted}
                delta={delta}
                inc={inc}
                exc={exc}
                onIncl={() => toggleIncl(c.id)}
                onExcl={() => toggleExcl(c.id)}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function SortPills({
  value,
  onChange,
}: {
  value: AssetSort;
  onChange: (v: AssetSort) => void;
}) {
  return (
    <div className="flex border border-white/10 rounded-md overflow-hidden">
      {(
        [
          ["xPts", "Pts"],
          ["price", "$"],
          ["delta", "Δ"],
        ] as const
      ).map(([k, l]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`px-2 text-[11px] mono transition ${
            value === k
              ? "bg-white/[0.08] text-white"
              : "text-white/40 hover:text-white/80"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ListHeader() {
  return (
    <div className="flex items-center px-3 py-1.5 border-b border-white/[0.04] text-[9px] uppercase tracking-[0.15em] text-white/30 font-medium">
      <div className="w-[58px]">Code</div>
      <div className="flex-1 text-right pr-2">$</div>
      <div className="w-12 text-right">xΔ$</div>
      <div className="w-12 text-right">xPts</div>
      <div className="w-14 text-right pl-1">Inc/Ex</div>
    </div>
  );
}

function AssetRow({
  code,
  color,
  price,
  xPts,
  delta,
  inc,
  exc,
  onIncl,
  onExcl,
}: {
  code: string;
  color: string;
  price: number;
  xPts: number;
  delta: number;
  inc: boolean;
  exc: boolean;
  onIncl: () => void;
  onExcl: () => void;
}) {
  const lightBg = isLightColor(color);
  const textColor = lightBg ? "#0b0b0d" : "#ffffff";
  return (
    <div className="flex items-center px-3 py-1.5 border-b border-white/[0.03] last:border-0 row-hover">
      <div className="w-[58px]">
        <span
          className="inline-block px-2 py-1 rounded font-display text-[11px] leading-none"
          style={{ background: color, color: textColor }}
        >
          {code}
        </span>
      </div>
      <div className="flex-1 text-right pr-2 mono text-[12px] text-white/85">
        {price.toFixed(1)}
      </div>
      <div
        className={`w-12 text-right mono text-[11px] ${
          delta > 0.02
            ? "text-[#34d39a]"
            : delta < -0.02
            ? "text-[#ef4444]"
            : "text-white/40"
        }`}
      >
        {delta >= 0 ? "+" : ""}
        {delta.toFixed(2)}
      </div>
      <div className="w-12 text-right mono text-[12px] font-medium text-white">
        {xPts.toFixed(1)}
      </div>
      <div className="w-14 flex justify-end gap-1 pl-1">
        <button
          onClick={onIncl}
          className={`btn w-6 h-6 grid place-items-center rounded text-[12px] transition ${
            inc
              ? "bg-[#34d39a] text-[#0b0b0d] border border-[#34d39a]"
              : "border border-white/10 text-white/35 hover:text-white hover:border-white/30"
          }`}
          title="Include — must be in lineup"
        >
          ✓
        </button>
        <button
          onClick={onExcl}
          className={`btn w-6 h-6 grid place-items-center rounded text-[12px] transition ${
            exc
              ? "bg-[#ef4444] text-white border border-[#ef4444]"
              : "border border-white/10 text-white/35 hover:text-white hover:border-white/30"
          }`}
          title="Exclude — never picked"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Panel wrapper
// ────────────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">{title}</div>
        {subtitle && (
          <div className="text-[11px] mono text-white/35">{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Price-move calculation (mirrors PriceTrends logic)
// ────────────────────────────────────────────────────────────────────

type PriceMoves = {
  driver: Map<number, number>;
  con: Map<ConstructorId, number>;
};

function buildPriceMoves(proj: Projections): PriceMoves {
  let totalDriverPrice = 0,
    totalDriverProj = 0;
  for (const dp of proj.drivers) {
    totalDriverPrice += dp.driver.price;
    totalDriverProj += dp.weighted;
  }
  const driverCoef = totalDriverProj > 0 ? totalDriverPrice / totalDriverProj : 1;

  let totalConPrice = 0,
    totalConProj = 0;
  for (const cp of proj.constructors) {
    totalConPrice += cp.constructor.price;
    totalConProj += cp.weighted;
  }
  const conCoef = totalConProj > 0 ? totalConPrice / totalConProj : 1;

  const driver = new Map<number, number>();
  for (const dp of proj.drivers) {
    const fair = Math.max(0, dp.weighted * driverCoef);
    driver.set(dp.driver.number, (fair - dp.driver.price) * 0.25);
  }
  const con = new Map<ConstructorId, number>();
  for (const cp of proj.constructors) {
    const fair = Math.max(0, cp.weighted * conCoef);
    con.set(cp.constructor.id, (fair - cp.constructor.price) * 0.25);
  }
  return { driver, con };
}

// suppress unused-import warnings when only referenced as values
void DRIVERS;
void CONSTRUCTORS;
void useEffect;
