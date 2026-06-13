"use client";

import { useMemo, useState } from "react";
import {
  BUDGET_CAP,
  DRS_BOOST_MULTIPLIER,
  SQUAD_SIZE,
  constructorById,
  driverByNumber,
  type Constructor,
  type ConstructorId,
  type Driver,
} from "../lib/data";
import type { Projections } from "../lib/form";
import { optimize } from "../lib/optimizer";
import { lineupCost, lineupProjected, type LineupState } from "./LineupBar";

type SortKey = "name" | "team" | "price" | "proj" | "ppm" | "trend";

export function Builder({
  proj,
  state,
  setState,
}: {
  proj: Projections;
  state: LineupState;
  setState: (s: LineupState) => void;
}) {
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [sortKey, setSortKey] = useState<SortKey>("proj");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");

  const cost = lineupCost(state);
  const projected = lineupProjected(state, proj);
  const remaining = BUDGET_CAP - cost;
  const overBudget = cost > BUDGET_CAP;
  const inDrivers = new Set(state.driverNumbers);
  const inConstructors = new Set(state.constructorIds);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const driverRows = useMemo(() => {
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
      let va: number | string = 0,
        vb: number | string = 0;
      switch (sortKey) {
        case "name": va = a.driver.acronym; vb = b.driver.acronym; break;
        case "team": va = a.driver.team; vb = b.driver.team; break;
        case "price": va = a.driver.price; vb = b.driver.price; break;
        case "proj": va = a.weighted; vb = b.weighted; break;
        case "ppm": va = a.pointsPerMillion; vb = b.pointsPerMillion; break;
        case "trend": va = a.trend; vb = b.trend; break;
      }
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [proj.drivers, q, sortKey, sortDir]);

  const conRows = useMemo(() => {
    let list = proj.constructors.slice();
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((p) =>
        p.constructor.short.toLowerCase().includes(ql) ||
        p.constructor.name.toLowerCase().includes(ql),
      );
    }
    list.sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      switch (sortKey) {
        case "name": va = a.constructor.short; vb = b.constructor.short; break;
        case "team": va = a.constructor.short; vb = b.constructor.short; break;
        case "price": va = a.constructor.price; vb = b.constructor.price; break;
        case "proj": va = a.weighted; vb = b.weighted; break;
        case "ppm": va = a.pointsPerMillion; vb = b.pointsPerMillion; break;
        case "trend": va = a.trend; vb = b.trend; break;
      }
      const cmp =
        typeof va === "string"
          ? va.localeCompare(vb as string)
          : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [proj.constructors, q, sortKey, sortDir]);

  function addDriver(n: number) {
    if (inDrivers.has(n) || state.driverNumbers.length >= SQUAD_SIZE.drivers) return;
    setState({
      ...state,
      driverNumbers: [...state.driverNumbers, n],
      captainNumber: state.captainNumber ?? n,
    });
  }
  function removeDriver(n: number) {
    setState({
      ...state,
      driverNumbers: state.driverNumbers.filter((x) => x !== n),
      captainNumber: state.captainNumber === n ? null : state.captainNumber,
    });
  }
  function toggleDriver(n: number) {
    if (inDrivers.has(n)) removeDriver(n);
    else addDriver(n);
  }
  function addConstructor(id: ConstructorId) {
    if (inConstructors.has(id) || state.constructorIds.length >= SQUAD_SIZE.constructors) return;
    setState({ ...state, constructorIds: [...state.constructorIds, id] });
  }
  function removeConstructor(id: ConstructorId) {
    setState({ ...state, constructorIds: state.constructorIds.filter((x) => x !== id) });
  }
  function toggleConstructor(id: ConstructorId) {
    if (inConstructors.has(id)) removeConstructor(id);
    else addConstructor(id);
  }
  function makeCaptain(n: number) {
    setState({ ...state, captainNumber: n });
  }
  function autoPick() {
    const top = optimize(proj, { topK: 1 });
    if (!top[0]) return;
    setState({
      driverNumbers: top[0].drivers.map((d) => d.number),
      constructorIds: top[0].constructors.map((c) => c.id),
      captainNumber: top[0].drsBoostDriver.number,
    });
  }
  function clearLineup() {
    setState({ driverNumbers: [], constructorIds: [], captainNumber: null });
  }

  return (
    <div className="space-y-6">
      <SquadStrip
        state={state}
        proj={proj}
        cost={cost}
        projected={projected}
        remaining={remaining}
        overBudget={overBudget}
        onRemoveDriver={removeDriver}
        onRemoveConstructor={removeConstructor}
        onMakeCaptain={makeCaptain}
        onAutoPick={autoPick}
        onClear={clearLineup}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex border border-white/10 rounded-md overflow-hidden">
              {(["drivers", "constructors"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-[12px] font-medium transition ${
                    tab === t
                      ? "bg-white/[0.08] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  {t === "drivers" ? "Drivers" : "Constructors"}
                </button>
              ))}
            </div>
            <div className="text-[12px] text-white/40">
              {tab === "drivers"
                ? `${state.driverNumbers.length}/${SQUAD_SIZE.drivers} picked`
                : `${state.constructorIds.length}/${SQUAD_SIZE.constructors} picked`}
            </div>
          </div>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="bg-transparent border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-white outline-none focus:border-white/30 w-56 placeholder:text-white/30"
          />
        </div>

        <div className="panel">
        {tab === "drivers" ? (
          <DriverTable
            rows={driverRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            inLineup={inDrivers}
            captain={state.captainNumber}
            onToggle={toggleDriver}
            onMakeCaptain={makeCaptain}
            full={state.driverNumbers.length >= SQUAD_SIZE.drivers}
          />
        ) : (
          <ConstructorTable
            rows={conRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            inLineup={inConstructors}
            onToggle={toggleConstructor}
            full={state.constructorIds.length >= SQUAD_SIZE.constructors}
          />
        )}
        </div>
      </div>
    </div>
  );
}

function SquadStrip({
  state,
  proj,
  cost,
  projected,
  remaining,
  overBudget,
  onRemoveDriver,
  onRemoveConstructor,
  onMakeCaptain,
  onAutoPick,
  onClear,
}: {
  state: LineupState;
  proj: Projections;
  cost: number;
  projected: number;
  remaining: number;
  overBudget: boolean;
  onRemoveDriver: (n: number) => void;
  onRemoveConstructor: (id: ConstructorId) => void;
  onMakeCaptain: (n: number) => void;
  onAutoPick: () => void;
  onClear: () => void;
}) {
  const driverObjs: (Driver | null)[] = Array.from(
    { length: SQUAD_SIZE.drivers },
    (_, i) => (state.driverNumbers[i] ? driverByNumber(state.driverNumbers[i]) ?? null : null),
  );
  const conObjs: (Constructor | null)[] = Array.from(
    { length: SQUAD_SIZE.constructors },
    (_, i) =>
      state.constructorIds[i] ? constructorById(state.constructorIds[i]) ?? null : null,
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">Your squad</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            disabled={state.driverNumbers.length === 0 && state.constructorIds.length === 0}
            className="btn btn-ghost text-[12px] px-3 py-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Clear
          </button>
          <button
            onClick={onAutoPick}
            className="btn btn-primary text-[12px] px-3.5 py-1.5"
          >
            Auto-pick best team
          </button>
        </div>
      </div>

      <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {driverObjs.map((d, i) => (
              <SquadCell
                key={`d${i}`}
                kind="driver"
                driver={d}
                proj={d ? proj.byDriverNumber.get(d.number)?.weighted ?? 0 : 0}
                isCaptain={d ? state.captainNumber === d.number : false}
                onRemove={() => d && onRemoveDriver(d.number)}
                onMakeCaptain={() => d && onMakeCaptain(d.number)}
                index={i + 1}
              />
            ))}
            <div className="w-3" />
            {conObjs.map((c, i) => (
              <SquadCell
                key={`c${i}`}
                kind="team"
                team={c}
                proj={c ? proj.byConstructorId.get(c.id)?.weighted ?? 0 : 0}
                onRemove={() => c && onRemoveConstructor(c.id)}
                index={i + 1}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 md:border-l md:border-white/[0.06] md:pl-6">
          <Stat
            label="Cost"
            value={`$${cost.toFixed(1)}`}
            sub={`/ $${BUDGET_CAP.toFixed(0)}M`}
            danger={overBudget}
          />
          <Stat
            label="Headroom"
            value={`$${Math.abs(remaining).toFixed(1)}M`}
            danger={overBudget}
          />
          <Stat
            label="Projected"
            value={projected.toFixed(1)}
            sub="pts"
            accent
            note={
              state.captainNumber != null
                ? `Boost: ${driverByNumber(state.captainNumber)?.acronym} ×${DRS_BOOST_MULTIPLIER}`
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  danger,
  accent,
  note,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
  accent?: boolean;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mb-1">
        {label}
      </div>
      <div
        className={`text-[22px] font-semibold mono leading-none ${
          danger ? "text-[#ef4444]" : accent ? "text-[#34d39a]" : "text-white"
        }`}
      >
        {value}
        {sub && <span className="text-white/35 text-[12px] ml-1 font-normal">{sub}</span>}
      </div>
      {note && (
        <div className="text-[10px] text-[#f5a524] mt-1">
          {note}
        </div>
      )}
    </div>
  );
}

function SquadCell({
  kind,
  driver,
  team: con,
  proj,
  isCaptain,
  onRemove,
  onMakeCaptain,
  index,
}: {
  kind: "driver" | "team";
  driver?: Driver | null;
  team?: Constructor | null;
  proj: number;
  isCaptain?: boolean;
  onRemove: () => void;
  onMakeCaptain?: () => void;
  index: number;
}) {
  const filled = !!(driver || con);
  const color = driver ? constructorById(driver.team)?.color : con?.color;

  if (!filled) {
    return (
      <div className="w-[88px] h-[64px] border border-dashed border-white/10 rounded-md flex items-center justify-center text-white/25 text-[10px] uppercase tracking-[0.15em]">
        {kind === "driver" ? "D" : "T"}
        {index}
      </div>
    );
  }

  return (
    <div
      className="relative w-[88px] h-[64px] border border-white/10 rounded-md bg-white/[0.02] hover:bg-white/[0.04] group transition"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-md"
        style={{ background: color }}
      />
      <button
        onClick={onRemove}
        className="absolute top-0.5 right-1 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs leading-none w-4 h-4 grid place-items-center"
        title="Remove"
      >
        ×
      </button>
      {isCaptain && (
        <div className="absolute bottom-0.5 right-1 text-[8px] text-[#f5a524] font-semibold tracking-wider">
          DRS
        </div>
      )}
      <div className="px-2 pt-2.5">
        <div className="font-display text-[15px] text-white leading-none">
          {driver ? driver.acronym : con?.short}
        </div>
        <div className="flex items-baseline justify-between mt-1.5 mono">
          <span className="text-[10px] text-white/45">
            ${(driver?.price ?? con?.price ?? 0).toFixed(1)}
          </span>
          <span className="text-[10px] text-[#34d39a]">{proj.toFixed(0)}</span>
        </div>
      </div>
      {kind === "driver" && onMakeCaptain && !isCaptain && (
        <button
          onClick={onMakeCaptain}
          title="Set as DRS Boost driver (×2 points)"
          className="absolute inset-0 grid place-items-end pb-0.5 opacity-0 group-hover:opacity-100 transition"
        >
          <span className="text-[8px] text-[#f5a524]/80 hover:text-[#f5a524] font-medium">
            set boost
          </span>
        </button>
      )}
    </div>
  );
}

function SortHeader({
  k,
  sortKey,
  sortDir,
  onSort,
  align,
  children,
}: {
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const active = k === sortKey;
  return (
    <th
      onClick={() => onSort(k)}
      className={`px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-medium cursor-pointer select-none transition ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-white" : "text-white/40 hover:text-white/70"}`}
    >
      {children}
      {active && <span className="ml-1 text-white/50">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function DriverTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  inLineup,
  captain,
  onToggle,
  onMakeCaptain,
  full,
}: {
  rows: import("../lib/form").DriverProjection[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  inLineup: Set<number>;
  captain: number | null;
  onToggle: (n: number) => void;
  onMakeCaptain: (n: number) => void;
  full: boolean;
}) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-white/[0.06]">
            <tr>
              <th className="w-8" />
              <SortHeader k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Driver</SortHeader>
              <SortHeader k="team" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Team</SortHeader>
              <SortHeader k="price" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Price</SortHeader>
              <SortHeader k="proj" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Proj</SortHeader>
              <SortHeader k="ppm" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Pts/$M</SortHeader>
              <SortHeader k="trend" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Trend</SortHeader>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-medium text-white/40 text-left w-32">Form</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((dp) => {
              const d = dp.driver;
              const team = constructorById(d.team);
              const picked = inLineup.has(d.number);
              const isCap = captain === d.number;
              const disabled = !picked && full;
              return (
                <tr
                  key={d.number}
                  onClick={() => !disabled && onToggle(d.number)}
                  className={`border-b border-white/[0.04] last:border-0 transition ${
                    picked
                      ? "selected-row"
                      : disabled
                      ? "opacity-30 cursor-not-allowed"
                      : "row-hover cursor-pointer"
                  }`}
                >
                  <td className="pl-3 w-8">
                    <span
                      className={`block w-2 h-2 rounded-full transition ${
                        picked ? "bg-[#34d39a]" : "bg-transparent border border-white/15"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-white">{d.acronym}</span>
                      <span className="text-[11px] text-white/30 mono">#{d.number}</span>
                      {isCap && (
                        <span className="text-[9px] uppercase tracking-wider text-[#f5a524] font-medium">
                          BOOST
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 truncate max-w-[180px]">
                      {d.name}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 text-[12px] text-white/70">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: team?.color }} />
                      {team?.short}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right mono text-white">
                    {d.price.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right mono font-medium text-[#34d39a]">
                    {dp.weighted.toFixed(1)}
                  </td>
                  <td className={`px-3 py-2.5 text-right mono ${dp.pointsPerMillion > 1.5 ? "text-[#34d39a]" : "text-white/60"}`}>
                    {dp.pointsPerMillion.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right mono ${
                      dp.trend > 0.5 ? "text-[#34d39a]" : dp.trend < -0.5 ? "text-[#ef4444]" : "text-white/40"
                    }`}
                  >
                    {dp.trend > 0.5 ? "↑" : dp.trend < -0.5 ? "↓" : ""}
                    {dp.trend.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Spark history={dp.history.map((h) => h.points)} color={team?.color ?? "#888"} />
                  </td>
                  <td className="pr-3 py-2.5 text-right">
                    {picked && !isCap && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeCaptain(d.number);
                        }}
                        className="text-[10px] text-[#f5a524]/70 hover:text-[#f5a524] font-medium uppercase tracking-wider"
                      >
                        Boost
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConstructorTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  inLineup,
  onToggle,
  full,
}: {
  rows: import("../lib/form").ConstructorProjection[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  inLineup: Set<ConstructorId>;
  onToggle: (id: ConstructorId) => void;
  full: boolean;
}) {
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-white/[0.02] border-b border-white/[0.06]">
            <tr>
              <th className="w-8" />
              <SortHeader k="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>Constructor</SortHeader>
              <SortHeader k="price" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Price</SortHeader>
              <SortHeader k="proj" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Proj</SortHeader>
              <SortHeader k="ppm" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Pts/$M</SortHeader>
              <SortHeader k="trend" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right">Trend</SortHeader>
              <th className="px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-medium text-white/40 text-left w-32">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cp) => {
              const c = cp.constructor;
              const picked = inLineup.has(c.id);
              const disabled = !picked && full;
              return (
                <tr
                  key={c.id}
                  onClick={() => !disabled && onToggle(c.id)}
                  className={`border-b border-white/[0.04] last:border-0 transition ${
                    picked
                      ? "selected-row"
                      : disabled
                      ? "opacity-30 cursor-not-allowed"
                      : "row-hover cursor-pointer"
                  }`}
                >
                  <td className="pl-3 w-8">
                    <span
                      className={`block w-2 h-2 rounded-full ${
                        picked ? "bg-[#34d39a]" : "bg-transparent border border-white/15"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                      <span className="font-medium text-white">{c.short}</span>
                      <span className="text-[11px] text-white/40">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right mono text-white">
                    {c.price.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right mono font-medium text-[#34d39a]">
                    {cp.weighted.toFixed(1)}
                  </td>
                  <td className={`px-3 py-2.5 text-right mono ${cp.pointsPerMillion > 1.5 ? "text-[#34d39a]" : "text-white/60"}`}>
                    {cp.pointsPerMillion.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right mono ${
                      cp.trend > 0.5 ? "text-[#34d39a]" : cp.trend < -0.5 ? "text-[#ef4444]" : "text-white/40"
                    }`}
                  >
                    {cp.trend > 0.5 ? "↑" : cp.trend < -0.5 ? "↓" : ""}
                    {cp.trend.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Spark history={cp.history.map((h) => h.points)} color={c.color} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Spark({ history, color }: { history: number[]; color: string }) {
  if (history.length === 0)
    return <span className="text-white/20 text-xs">—</span>;
  const max = Math.max(...history.map((x) => Math.max(x, 0)), 1);
  return (
    <div className="flex items-end gap-0.5 h-5 w-28">
      {history.map((p, i) => (
        <div
          key={i}
          title={`R${i + 1}: ${p} pts`}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max((Math.max(p, 0) / max) * 100, 8)}%`,
            background: p >= 0 ? color : "#333",
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
