"use client";

import { useMemo, useState } from "react";
import {
  CONSTRUCTORS,
  DRIVERS,
  type Constructor,
  type Driver,
} from "../lib/data";
import type { Projections } from "../lib/form";
import {
  lineupCost,
  lineupProjected,
  type LineupState,
} from "./LineupBar";
import { usePersisted } from "../lib/persisted";
import { ConstructorChip, DriverChip } from "./AssetCard";

const STORE_KEY = "f1fantasy:savedLineups";

type SavedLineup = LineupState & { name: string; savedAt: string };

export function Compare({
  proj,
  current,
  setLineup,
}: {
  proj: Projections;
  current: LineupState;
  setLineup: (s: LineupState) => void;
}) {
  // Persisted to localStorage; SSR-safe via useSyncExternalStore (see usePersisted).
  const emptySaved = useMemo<SavedLineup[]>(() => [], []);
  const [saved, setSaved] = usePersisted<SavedLineup[]>(STORE_KEY, emptySaved);
  const [aIdx, setAIdx] = useState<number | "current">("current");
  const [bIdx, setBIdx] = useState<number | "current" | null>(null);
  const [name, setName] = useState("My lineup");

  function save() {
    const next: SavedLineup = {
      ...current,
      name: name || "Untitled",
      savedAt: new Date().toISOString(),
    };
    setSaved([next, ...saved].slice(0, 12));
  }
  function remove(i: number) {
    setSaved(saved.filter((_, idx) => idx !== i));
  }
  function pick(which: "a" | "b", v: number | "current" | null) {
    if (which === "a") setAIdx(v === null ? "current" : v);
    else setBIdx(v);
  }

  function lineupAt(idx: number | "current" | null): LineupState | null {
    if (idx == null) return null;
    if (idx === "current") return current;
    return saved[idx] ?? null;
  }

  const A = lineupAt(aIdx);
  const B = lineupAt(bIdx);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 pb-4 border-b border-white/5">
        <div>
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-1">
            Save current
          </div>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lineup name"
              className="bg-zinc-900 border border-white/10 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-white/40 w-48"
            />
            <button
              onClick={save}
              disabled={
                current.driverNumbers.length === 0 &&
                current.constructorIds.length === 0
              }
              className="px-4 py-1.5 bg-white text-black font-display tracking-[0.2em] uppercase text-[10px] rounded hover:bg-white/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
        <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 ml-auto">
          {saved.length} saved (max 12, browser-local)
        </div>
      </div>

      {saved.length > 0 && (
        <div>
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-2">
            Saved lineups
          </div>
          <div className="flex flex-wrap gap-2">
            {saved.map((s, i) => {
              const cost = lineupCost(s);
              const projected = lineupProjected(s, proj);
              return (
                <div
                  key={i}
                  className="bg-zinc-950 border border-white/10 rounded p-2 text-xs flex items-center gap-3"
                >
                  <div>
                    <div className="font-display text-white">{s.name}</div>
                    <div className="text-white/40 tabular-nums">
                      ${cost.toFixed(1)} · {projected.toFixed(1)} pts
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => pick("a", i)}
                      className={`px-2 py-1 text-[10px] font-display tracking-widest uppercase rounded ${
                        aIdx === i ? "bg-blue-500 text-white" : "bg-zinc-800 text-white/60 hover:text-white"
                      }`}
                    >
                      A
                    </button>
                    <button
                      onClick={() => pick("b", i)}
                      className={`px-2 py-1 text-[10px] font-display tracking-widest uppercase rounded ${
                        bIdx === i ? "bg-purple-500 text-white" : "bg-zinc-800 text-white/60 hover:text-white"
                      }`}
                    >
                      B
                    </button>
                    <button
                      onClick={() => setLineup(s)}
                      className="px-2 py-1 text-[10px] font-display tracking-widest uppercase rounded bg-zinc-800 text-white/60 hover:text-white"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => remove(i)}
                      className="px-2 py-1 text-[10px] font-display tracking-widest uppercase rounded text-white/30 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Side
          label="A"
          color="#3b82f6"
          state={A}
          proj={proj}
          isCurrent={aIdx === "current"}
          name={aIdx === "current" ? "Current lineup" : saved[aIdx as number]?.name}
        />
        <Side
          label="B"
          color="#a855f7"
          state={B}
          proj={proj}
          isCurrent={bIdx === "current"}
          name={
            bIdx == null
              ? null
              : bIdx === "current"
                ? "Current lineup"
                : saved[bIdx as number]?.name
          }
          onPickCurrent={() => pick("b", "current")}
        />
      </div>

      {A && B && (
        <DeltaPanel a={A} b={B} proj={proj} />
      )}
    </div>
  );
}

function Side({
  label,
  color,
  state,
  proj,
  isCurrent,
  name,
  onPickCurrent,
}: {
  label: string;
  color: string;
  state: LineupState | null;
  proj: Projections;
  isCurrent: boolean;
  name: string | null | undefined;
  onPickCurrent?: () => void;
}) {
  if (!state) {
    return (
      <div className="border border-dashed border-white/10 rounded p-6 text-center">
        <div
          className="inline-block w-6 h-6 rounded mb-2 font-display text-xs leading-6 text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </div>
        <div className="text-white/40 text-sm">Pick a saved lineup</div>
        {onPickCurrent && (
          <button
            onClick={onPickCurrent}
            className="mt-3 px-3 py-1 text-[10px] font-display tracking-widest uppercase rounded bg-zinc-800 text-white/70 hover:text-white"
          >
            Use current
          </button>
        )}
      </div>
    );
  }
  const cost = lineupCost(state);
  const projected = lineupProjected(state, proj);

  const drivers = state.driverNumbers
    .map((n) => DRIVERS.find((d) => d.number === n))
    .filter((x): x is Driver => !!x);
  const cons = state.constructorIds
    .map((id) => CONSTRUCTORS.find((c) => c.id === id))
    .filter((x): x is Constructor => !!x);

  return (
    <div className="bg-zinc-950 border border-white/10 rounded p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded font-display text-xs leading-6 text-center text-white"
            style={{ backgroundColor: color }}
          >
            {label}
          </div>
          <div className="font-display text-white">
            {name ?? "Lineup"}{" "}
            {isCurrent && <span className="text-white/40 text-xs">(live)</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
            Projected
          </div>
          <div className="font-display text-2xl tabular-nums text-emerald-300">
            {projected.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="text-[10px] tabular-nums text-white/50">
        Cost ${cost.toFixed(1)}M
      </div>

      <div>
        <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-1">
          Drivers
        </div>
        <div className="space-y-1">
          {drivers.map((d) => {
            const dp = proj.byDriverNumber.get(d.number);
            const isCap = state.captainNumber === d.number;
            return (
              <div key={d.number} className="flex items-center gap-2 text-sm">
                <DriverChip d={d} />
                {isCap && (
                  <span className="text-yellow-300 text-[9px] font-display tracking-[0.25em]">
                    BOOST
                  </span>
                )}
                <span className="text-white/40 ml-auto tabular-nums text-xs">
                  ${d.price.toFixed(1)} · proj{" "}
                  <span className="text-white/80">
                    {(dp?.weighted ?? 0).toFixed(1)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-1">
          Constructors
        </div>
        <div className="space-y-1">
          {cons.map((c) => {
            const cp = proj.byConstructorId.get(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <ConstructorChip c={c} />
                <span className="text-white/40 ml-auto tabular-nums text-xs">
                  ${c.price.toFixed(1)} · proj{" "}
                  <span className="text-white/80">
                    {(cp?.weighted ?? 0).toFixed(1)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeltaPanel({
  a,
  b,
  proj,
}: {
  a: LineupState;
  b: LineupState;
  proj: Projections;
}) {
  const ap = lineupProjected(a, proj);
  const bp = lineupProjected(b, proj);
  const ac = lineupCost(a);
  const bc = lineupCost(b);
  const dPts = bp - ap;
  const dCost = bc - ac;

  const aDr = new Set(a.driverNumbers);
  const bDr = new Set(b.driverNumbers);
  const aCo = new Set(a.constructorIds);
  const bCo = new Set(b.constructorIds);

  const onlyA_d = a.driverNumbers
    .filter((n) => !bDr.has(n))
    .map((n) => DRIVERS.find((d) => d.number === n)!)
    .filter(Boolean);
  const onlyB_d = b.driverNumbers
    .filter((n) => !aDr.has(n))
    .map((n) => DRIVERS.find((d) => d.number === n)!)
    .filter(Boolean);
  const onlyA_c = a.constructorIds
    .filter((id) => !bCo.has(id))
    .map((id) => CONSTRUCTORS.find((c) => c.id === id)!)
    .filter(Boolean);
  const onlyB_c = b.constructorIds
    .filter((id) => !aCo.has(id))
    .map((id) => CONSTRUCTORS.find((c) => c.id === id)!)
    .filter(Boolean);

  return (
    <div className="bg-zinc-950 border border-white/10 rounded p-4">
      <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-3">
        Delta (B vs A)
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Big label="Projected" value={`${dPts >= 0 ? "+" : ""}${dPts.toFixed(1)}`} good={dPts > 0} bad={dPts < 0} />
        <Big label="Cost" value={`${dCost >= 0 ? "+" : ""}${dCost.toFixed(1)}`} good={dCost < 0} bad={dCost > 0} />
        <Big label="Pts/$ delta" value={dCost === 0 ? "—" : `${(dPts / Math.abs(dCost || 1)).toFixed(2)}`} />
        <Big
          label="Captain"
          value={
            a.captainNumber === b.captainNumber
              ? "Same"
              : `${proj.byDriverNumber.get(a.captainNumber ?? -1)?.driver.acronym ?? "—"} → ${proj.byDriverNumber.get(b.captainNumber ?? -1)?.driver.acronym ?? "—"}`
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Diff label="Drops (in A only)" items={[
          ...onlyA_d.map((d) => `${d.acronym} ($${d.price.toFixed(1)})`),
          ...onlyA_c.map((c) => `${c.short} ($${c.price.toFixed(1)})`),
        ]} color="text-red-300/80" />
        <Diff label="Adds (in B only)" items={[
          ...onlyB_d.map((d) => `${d.acronym} ($${d.price.toFixed(1)})`),
          ...onlyB_c.map((c) => `${c.short} ($${c.price.toFixed(1)})`),
        ]} color="text-emerald-300/80" />
      </div>
    </div>
  );
}

function Big({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40">
        {label}
      </div>
      <div
        className={`font-display text-2xl tabular-nums ${
          good ? "text-emerald-300" : bad ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Diff({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-display tracking-[0.3em] uppercase text-white/40 mb-1">
        {label}
      </div>
      {items.length === 0 ? (
        <div className="text-white/30 text-xs">none</div>
      ) : (
        <ul className={`text-xs space-y-0.5 ${color}`}>
          {items.map((it, i) => (
            <li key={i}>· {it}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
