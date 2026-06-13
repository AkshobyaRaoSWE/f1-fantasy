"use client";

import { constructorById } from "../lib/data";
import type { Constructor, Driver } from "../lib/data";
import type { DriverProjection, ConstructorProjection } from "../lib/form";

export function DriverCard({
  proj,
  onAdd,
  onRemove,
  inLineup,
  isCaptain,
  onMakeCaptain,
  compact,
}: {
  proj: DriverProjection;
  onAdd?: () => void;
  onRemove?: () => void;
  inLineup?: boolean;
  isCaptain?: boolean;
  onMakeCaptain?: () => void;
  compact?: boolean;
}) {
  const d = proj.driver;
  const team = constructorById(d.team);
  const color = team?.color ?? "#888";
  return (
    <div
      className={`relative bg-zinc-950 border ${
        inLineup ? "border-white/40" : "border-white/10"
      } rounded-md p-3 transition hover:border-white/30 group`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: color }}
      />
      {isCaptain && (
        <div
          className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[9px] font-display tracking-[0.25em] uppercase rounded text-black"
          style={{ backgroundColor: "#FFEC1F" }}
        >
          DRS×2
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 ml-2">
        <div className="min-w-0">
          <div className="font-display text-base text-white tracking-tight truncate">
            {d.acronym}{" "}
            <span className="text-white/30 text-xs tabular-nums">
              #{d.number}
            </span>
          </div>
          {!compact && (
            <div className="text-[10px] text-white/40 truncate">
              {d.name} · {team?.short}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-sm text-white tabular-nums">
            ${d.price.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mt-2 ml-2 grid grid-cols-3 gap-2 text-[10px]">
        <Stat label="Proj" value={proj.weighted.toFixed(1)} accent />
        <Stat label="Avg" value={proj.avg.toFixed(1)} />
        <Stat
          label="PPM"
          value={proj.pointsPerMillion.toFixed(2)}
          trendUp={proj.pointsPerMillion > 1.5}
        />
      </div>

      {!compact && proj.history.length > 0 && (
        <div className="mt-2 ml-2 flex items-end gap-1 h-6">
          {proj.history.map((h) => {
            const max = Math.max(
              ...proj.history.map((x) => Math.max(x.points, 0)),
              1,
            );
            const hp = Math.max(0, h.points);
            const heightPct = (hp / max) * 100;
            return (
              <div
                key={h.round}
                title={`R${h.round} ${h.raceName}: ${h.points} pts`}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(heightPct, 5)}%`,
                  backgroundColor: h.points >= 0 ? color : "#444",
                  opacity: h.points >= 0 ? 0.85 : 0.6,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="mt-2 ml-2 flex gap-1.5">
        {!inLineup && onAdd && (
          <button
            onClick={onAdd}
            className="flex-1 py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded bg-white text-black hover:bg-white/90 transition"
          >
            Add
          </button>
        )}
        {inLineup && onRemove && (
          <button
            onClick={onRemove}
            className="flex-1 py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded bg-zinc-800 text-white/70 hover:bg-zinc-700 transition"
          >
            Drop
          </button>
        )}
        {inLineup && !isCaptain && onMakeCaptain && (
          <button
            onClick={onMakeCaptain}
            className="px-2 py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded border border-yellow-300/30 text-yellow-300/80 hover:bg-yellow-300/10 transition"
            title="Set as DRS Boost driver (2x points this round)"
          >
            Boost
          </button>
        )}
      </div>
    </div>
  );
}

export function ConstructorCard({
  proj,
  onAdd,
  onRemove,
  inLineup,
  compact,
}: {
  proj: ConstructorProjection;
  onAdd?: () => void;
  onRemove?: () => void;
  inLineup?: boolean;
  compact?: boolean;
}) {
  const c = proj.constructor;
  return (
    <div
      className={`relative bg-zinc-950 border ${
        inLineup ? "border-white/40" : "border-white/10"
      } rounded-md p-3 transition hover:border-white/30`}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
        style={{ backgroundColor: c.color }}
      />
      <div className="flex items-baseline justify-between gap-2 ml-2">
        <div className="min-w-0">
          <div className="font-display text-base text-white tracking-tight truncate">
            {c.short}
          </div>
          {!compact && (
            <div className="text-[10px] text-white/40 truncate">{c.name}</div>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-sm text-white tabular-nums">
            ${c.price.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mt-2 ml-2 grid grid-cols-3 gap-2 text-[10px]">
        <Stat label="Proj" value={proj.weighted.toFixed(1)} accent />
        <Stat label="Avg" value={proj.avg.toFixed(1)} />
        <Stat
          label="PPM"
          value={proj.pointsPerMillion.toFixed(2)}
          trendUp={proj.pointsPerMillion > 1.5}
        />
      </div>

      {!compact && proj.history.length > 0 && (
        <div className="mt-2 ml-2 flex items-end gap-1 h-6">
          {proj.history.map((h) => {
            const max = Math.max(
              ...proj.history.map((x) => Math.max(x.points, 0)),
              1,
            );
            const heightPct = (Math.max(0, h.points) / max) * 100;
            return (
              <div
                key={h.round}
                title={`R${h.round}: ${h.points} pts`}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(heightPct, 5)}%`,
                  backgroundColor: c.color,
                  opacity: 0.85,
                }}
              />
            );
          })}
        </div>
      )}

      <div className="mt-2 ml-2">
        {!inLineup && onAdd && (
          <button
            onClick={onAdd}
            className="w-full py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded bg-white text-black hover:bg-white/90 transition"
          >
            Add
          </button>
        )}
        {inLineup && onRemove && (
          <button
            onClick={onRemove}
            className="w-full py-1 text-[10px] font-display tracking-[0.2em] uppercase rounded bg-zinc-800 text-white/70 hover:bg-zinc-700 transition"
          >
            Drop
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  trendUp,
}: {
  label: string;
  value: string;
  accent?: boolean;
  trendUp?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-white/40 font-display tracking-[0.2em] uppercase text-[8px]">
        {label}
      </div>
      <div
        className={`tabular-nums font-display ${
          accent ? "text-white" : trendUp ? "text-green-400" : "text-white/70"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// Mini chip for use inside dense layouts (e.g. lineup slot row).
export function DriverChip({ d }: { d: Driver }) {
  const team = constructorById(d.team);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-display tracking-wide"
      style={{ backgroundColor: `${team?.color ?? "#888"}33`, color: team?.color }}
    >
      <span className="w-1 h-3 rounded-sm" style={{ backgroundColor: team?.color }} />
      {d.acronym}
    </span>
  );
}

export function ConstructorChip({ c }: { c: Constructor }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-display tracking-wide"
      style={{ backgroundColor: `${c.color}33`, color: c.color }}
    >
      <span className="w-1 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
      {c.short}
    </span>
  );
}
