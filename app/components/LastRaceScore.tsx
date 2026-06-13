"use client";

import { useMemo } from "react";
import {
  CONSTRUCTORS,
  DRIVERS,
  DRS_BOOST_MULTIPLIER,
  constructorById,
  teammate,
  type Constructor,
  type Driver,
} from "../lib/data";
import type { Projections } from "../lib/form";
import {
  scoreConstructorWeekend,
  scoreDriverWeekend,
} from "../lib/scoring";
import type { LineupState } from "./LineupBar";

export function LastRaceScore({
  proj,
  state,
}: {
  proj: Projections;
  state: LineupState;
}) {
  const round = proj.rounds[proj.rounds.length - 1];
  const today = new Date();
  const raceDate = round ? new Date(round.date) : null;
  const daysAgo = raceDate
    ? Math.floor((today.getTime() - raceDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isLive = daysAgo != null && daysAgo >= 0 && daysAgo <= 2;

  const drivers: Driver[] = state.driverNumbers
    .map((n) => DRIVERS.find((d) => d.number === n))
    .filter((x): x is Driver => !!x);
  const cons: Constructor[] = state.constructorIds
    .map((id) => CONSTRUCTORS.find((c) => c.id === id))
    .filter((x): x is Constructor => !!x);

  const breakdown = useMemo(() => {
    if (!round) return null;
    const sess = {
      hasSprint: round.hasSprint,
      results: round.results,
      sprintResults: round.sprintResults ?? undefined,
    };

    const driverRows = drivers.map((d) => {
      const tm = teammate(d);
      const base = scoreDriverWeekend(d.number, sess, tm?.number ?? null);
      const isCap = state.captainNumber === d.number;
      const total = isCap ? base * DRS_BOOST_MULTIPLIER : base;
      return { driver: d, base, isCap, total };
    });
    const conRows = cons.map((c) => {
      const teamDrivers = DRIVERS.filter((x) => x.team === c.id);
      const pts = scoreConstructorWeekend(
        teamDrivers.map((d) => d.number),
        sess,
      );
      return { constructor: c, points: pts };
    });
    const total =
      driverRows.reduce((s, r) => s + r.total, 0) +
      conRows.reduce((s, r) => s + r.points, 0);

    return { driverRows, conRows, total };
  }, [round, drivers, cons, state.captainNumber]);

  if (!round) {
    return (
      <div className="py-12 text-center text-white/35 text-[13px]">
        No race data available yet.
      </div>
    );
  }

  if (drivers.length + cons.length === 0) {
    return (
      <div className="space-y-6">
        <RoundHeader round={round} isLive={isLive} daysAgo={daysAgo} />
        <div className="py-12 text-center text-white/35 text-[13px] border border-dashed border-white/[0.08] rounded-lg">
          Build a lineup on Pick Team to see how it scored this round.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-in">
      <RoundHeader round={round} isLive={isLive} daysAgo={daysAgo} />

      <div className="panel">
        <div className="flex items-baseline justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mb-1">
              Your lineup scored
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[40px] font-semibold mono text-[#34d39a] leading-none">
                {breakdown!.total.toFixed(0)}
              </span>
              <span className="text-[12px] text-white/40">pts</span>
            </div>
          </div>
        </div>

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="px-5 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">
                Asset
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">
                Detail
              </th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">
                Base
              </th>
              <th className="px-5 py-2 text-right text-[10px] uppercase tracking-[0.15em] text-white/35 font-medium">
                Scored
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown!.driverRows.map((row, i) => {
              const team = constructorById(row.driver.team);
              const r = round.results.find((x) => x.driverNumber === row.driver.number);
              return (
                <tr
                  key={row.driver.number}
                  className="border-b border-white/[0.03] last:border-0 row-in"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <td className="px-5 py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-white">{row.driver.acronym}</span>
                      <span className="text-[11px] text-white/30 mono">#{row.driver.number}</span>
                      {row.isCap && (
                        <span className="text-[9px] uppercase tracking-wider text-[#f5a524] font-medium">
                          BOOST ×{DRS_BOOST_MULTIPLIER}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/45 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: team?.color }} />
                      {team?.short}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-white/55">
                    {r ? (
                      <>
                        Q{r.qualiPosition ?? "?"} → P{r.finishPosition ?? "?"}
                        {r.fastestLap && (
                          <span className="ml-2 text-[#a78bfa]">FL</span>
                        )}
                        {r.status === "dnf" && (
                          <span className="ml-2 text-[#ef4444]">DNF</span>
                        )}
                        {r.status === "dsq" && (
                          <span className="ml-2 text-[#ef4444]">DSQ</span>
                        )}
                        {round.hasSprint && <span className="ml-2 text-white/35">+ sprint</span>}
                      </>
                    ) : (
                      <span className="text-white/25">no data</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right mono text-white/65">
                    {row.base.toFixed(0)}
                  </td>
                  <td className="px-5 py-2.5 text-right mono text-[#34d39a] font-medium">
                    {row.total.toFixed(0)}
                  </td>
                </tr>
              );
            })}
            {breakdown!.conRows.map((row, i) => (
              <tr
                key={row.constructor.id}
                className="border-b border-white/[0.03] last:border-0 bg-white/[0.015] row-in"
                style={{ animationDelay: `${(breakdown!.driverRows.length + i) * 35}ms` }}
              >
                <td className="px-5 py-2.5">
                  <span className="font-medium text-white">{row.constructor.short}</span>
                  <span className="text-[11px] text-white/40 ml-2">{row.constructor.name}</span>
                </td>
                <td className="px-3 py-2.5 text-[11px] text-white/45">both cars combined</td>
                <td className="px-3 py-2.5 text-right mono text-white/65">
                  {row.points.toFixed(0)}
                </td>
                <td className="px-5 py-2.5 text-right mono text-[#34d39a] font-medium">
                  {row.points.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-white/30">
        Scoring uses the rules in app/lib/scoring.ts. Driver-of-the-day is not
        in the public API and is excluded.
      </div>
    </div>
  );
}

function RoundHeader({
  round,
  isLive,
  daysAgo,
}: {
  round: { round: number; raceName: string; date: string; country: string; hasSprint: boolean };
  isLive: boolean;
  daysAgo: number | null;
}) {
  return (
    <div className="flex items-baseline justify-between flex-wrap gap-3 pb-4 border-b border-white/[0.06]">
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-medium mono">
          R{round.round}
        </span>
        <span className="font-medium text-white text-[18px]">{round.raceName}</span>
        {round.hasSprint && (
          <span className="badge text-[#a78bfa]">Sprint weekend</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isLive ? (
          <span className="inline-flex items-center gap-2 text-[11px] text-[#34d39a]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d39a] pulse-dot" />
            Race weekend just ended
          </span>
        ) : (
          <span className="text-[11px] text-white/35">
            {daysAgo == null
              ? "—"
              : daysAgo === 0
              ? "today"
              : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`}
          </span>
        )}
      </div>
    </div>
  );
}
