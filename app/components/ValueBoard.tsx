"use client";

import { useMemo, useState } from "react";
import type { Projections } from "../lib/form";
import { constructorById } from "../lib/data";

type SortKey =
  | "name"
  | "team"
  | "price"
  | "proj"
  | "avg"
  | "ppm"
  | "trend"
  | "starts";

export function ValueBoard({ proj }: { proj: Projections }) {
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [sortKey, setSortKey] = useState<SortKey>("ppm");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const driverRows = useMemo(() => {
    const rows = proj.drivers.slice();
    rows.sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      switch (sortKey) {
        case "name": va = a.driver.acronym; vb = b.driver.acronym; break;
        case "team": va = a.driver.team; vb = b.driver.team; break;
        case "price": va = a.driver.price; vb = b.driver.price; break;
        case "proj": va = a.weighted; vb = b.weighted; break;
        case "avg": va = a.avg; vb = b.avg; break;
        case "ppm": va = a.pointsPerMillion; vb = b.pointsPerMillion; break;
        case "trend": va = a.trend; vb = b.trend; break;
        case "starts": va = a.startsCounted; vb = b.startsCounted; break;
      }
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [proj.drivers, sortKey, sortDir]);

  const conRows = useMemo(() => {
    const rows = proj.constructors.slice();
    rows.sort((a, b) => {
      let va: number | string = 0,
        vb: number | string = 0;
      switch (sortKey) {
        case "name": va = a.constructor.short; vb = b.constructor.short; break;
        case "team": va = a.constructor.short; vb = b.constructor.short; break;
        case "price": va = a.constructor.price; vb = b.constructor.price; break;
        case "proj": va = a.weighted; vb = b.weighted; break;
        case "avg": va = a.avg; vb = b.avg; break;
        case "ppm": va = a.pointsPerMillion; vb = b.pointsPerMillion; break;
        case "trend": va = a.trend; vb = b.trend; break;
        case "starts": va = a.startsCounted; vb = b.startsCounted; break;
      }
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [proj.constructors, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex border border-white/10 rounded-md overflow-hidden">
          {(["drivers", "constructors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[12px] font-medium transition ${
                tab === t ? "bg-white/[0.08] text-white" : "text-white/50 hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              {t === "drivers" ? "Drivers" : "Constructors"}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-white/35">
          Sort by any column. Pts/$M shows value.
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-white/10 bg-[#131318]">
        <table className="w-full text-[13px]">
          <thead className="border-b border-white/[0.06]">
            <tr className="border-b border-white/10">
              {tab === "drivers" ? (
                <>
                  <Th k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Driver</Th>
                  <Th k="team" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Team</Th>
                </>
              ) : (
                <Th k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Constructor</Th>
              )}
              <Th k="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>$M</Th>
              <Th k="proj" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>Projected</Th>
              <Th k="avg" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>Avg</Th>
              <Th k="ppm" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>PPM</Th>
              <Th k="trend" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>Trend</Th>
              <Th k="starts" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} right>Starts</Th>
              <th className="px-3 py-2 text-left text-[10px] font-display tracking-[0.2em] uppercase text-white/40">
                Recent
              </th>
            </tr>
          </thead>
          <tbody>
            {tab === "drivers"
              ? driverRows.map((dp) => {
                  const t = constructorById(dp.driver.team);
                  return (
                    <tr
                      key={dp.driver.number}
                      className="border-b border-white/[0.04] last:border-0 row-hover"
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-white">
                          {dp.driver.acronym}
                        </span>
                        <span className="text-white/30 text-[11px] ml-2 mono">
                          #{dp.driver.number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2 text-[12px] text-white/65">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t?.color }} />
                          {t?.short}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right mono text-white/85">
                        {dp.driver.price.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right mono font-medium text-[#34d39a]">
                        {dp.weighted.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right mono text-white/60">
                        {dp.avg.toFixed(1)}
                      </td>
                      <PpmCell v={dp.pointsPerMillion} />
                      <TrendCell v={dp.trend} />
                      <td className="px-3 py-2.5 text-right mono text-white/40 text-[11px]">
                        {dp.startsCounted}
                      </td>
                      <Spark history={dp.history.map((h) => h.points)} color={t?.color ?? "#888"} />
                    </tr>
                  );
                })
              : conRows.map((cp) => (
                  <tr
                    key={cp.constructor.id}
                    className="border-b border-white/[0.04] last:border-0 row-hover"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-baseline gap-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cp.constructor.color }} />
                        <span className="font-medium text-white">{cp.constructor.short}</span>
                        <span className="text-white/40 text-[11px]">{cp.constructor.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-white/85">
                      {cp.constructor.price.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono font-medium text-[#34d39a]">
                      {cp.weighted.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right mono text-white/60">
                      {cp.avg.toFixed(1)}
                    </td>
                    <PpmCell v={cp.pointsPerMillion} />
                    <TrendCell v={cp.trend} />
                    <td className="px-3 py-2.5 text-right mono text-white/40 text-[11px]">
                      {cp.startsCounted}
                    </td>
                    <Spark history={cp.history.map((h) => h.points)} color={cp.constructor.color} />
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  k,
  children,
  sortKey,
  sortDir,
  onClick,
  right,
}: {
  k: SortKey;
  children: React.ReactNode;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = k === sortKey;
  return (
    <th
      className={`px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-medium ${
        right ? "text-right" : "text-left"
      } ${active ? "text-white" : "text-white/40 hover:text-white/70"} cursor-pointer select-none`}
      onClick={() => onClick(k)}
    >
      {children}
      {active && <span className="ml-1 text-white/50">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function PpmCell({ v }: { v: number }) {
  const good = v > 1.5;
  const great = v > 2.5;
  return (
    <td
      className={`px-3 py-2.5 text-right mono ${
        great ? "text-[#34d39a] font-medium" : good ? "text-[#34d39a]/70" : "text-white/55"
      }`}
    >
      {v.toFixed(2)}
    </td>
  );
}

function TrendCell({ v }: { v: number }) {
  const sign = v > 0.5 ? "↑" : v < -0.5 ? "↓" : "";
  const cls =
    v > 0.5 ? "text-[#34d39a]" : v < -0.5 ? "text-[#ef4444]" : "text-white/40";
  return (
    <td className={`px-3 py-2.5 text-right mono ${cls}`}>
      {sign}{v.toFixed(1)}
    </td>
  );
}

function Spark({ history, color }: { history: number[]; color: string }) {
  if (history.length === 0)
    return <td className="px-3 py-2.5 text-white/20 text-xs">—</td>;
  const max = Math.max(...history.map((x) => Math.max(x, 0)), 1);
  return (
    <td className="px-3 py-2.5 w-28">
      <div className="flex items-end gap-0.5 h-5">
        {history.map((p, i) => (
          <div
            key={i}
            title={`R${i + 1}: ${p} pts`}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max((Math.max(p, 0) / max) * 100, 8)}%`,
              backgroundColor: p >= 0 ? color : "#333",
              opacity: 0.7,
            }}
          />
        ))}
      </div>
    </td>
  );
}
