// Pulls last N rounds of the current season from Jolpica (Ergast mirror).
// Bakes ./public/form.json with raw race + qualifying + sprint results.
// Driver-of-the-day is not in Ergast; that flag will be false. [VERIFY THIS]
//
// Run:
//   node scripts/fetch-form.mjs
//   node scripts/fetch-form.mjs --season=2026 --rounds=8
//
// Idempotent. Writes a partial file even if some rounds 404 (future races).

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "form.json");

const argSeason = process.argv.find((a) => a.startsWith("--season="));
const argRounds = process.argv.find((a) => a.startsWith("--rounds="));
const SEASON = argSeason ? Number(argSeason.split("=")[1]) : new Date().getFullYear();
const ROUNDS = argRounds ? Number(argRounds.split("=")[1]) : 8;

const BASE = "https://api.jolpi.ca/ergast/f1";

class Limiter {
  constructor(rps = 3) {
    this.interval = 1000 / rps;
    this.next = 0;
  }
  async acquire() {
    const now = Date.now();
    const wait = Math.max(0, this.next - now);
    this.next = Math.max(now, this.next) + this.interval;
    if (wait) await new Promise((r) => setTimeout(r, wait));
  }
}
const limiter = new Limiter(3);

async function get(url, attempt = 0) {
  await limiter.acquire();
  const r = await fetch(url);
  if (r.status === 429 || r.status >= 500) {
    if (attempt > 4) throw new Error(`${r.status} after retries: ${url}`);
    const back = 1500 * Math.pow(1.6, attempt);
    console.warn(`  ${r.status}, backoff ${back}ms`);
    await new Promise((r2) => setTimeout(r2, back));
    return get(url, attempt + 1);
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

function parseGrid(g) {
  const n = Number(g);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function statusFromErgast(s) {
  const t = (s || "").toLowerCase();
  if (t === "finished" || t.includes("lap")) return "finished";
  if (t.includes("disqualif")) return "dsq";
  return "dnf";
}

function buildResultRow(r) {
  return {
    driverNumber: Number(r.number),
    gridPosition: parseGrid(r.grid),
    finishPosition: r.position && r.position !== "R" ? Number(r.position) : null,
    qualiPosition: null, // filled later
    fastestLap: r.FastestLap?.rank === "1",
    dotd: false, // [VERIFY THIS] not in Ergast
    status: statusFromErgast(r.status),
  };
}

async function fetchSchedule() {
  const data = await get(`${BASE}/${SEASON}.json`);
  if (!data) return [];
  const races = data?.MRData?.RaceTable?.Races ?? [];
  return races.map((r) => ({
    round: Number(r.round),
    raceName: r.raceName,
    date: r.date,
    locality: r.Circuit?.Location?.locality,
    country: r.Circuit?.Location?.country,
  }));
}

async function fetchRound(round) {
  const [resJ, qJ, spJ] = await Promise.all([
    get(`${BASE}/${SEASON}/${round}/results.json`),
    get(`${BASE}/${SEASON}/${round}/qualifying.json`),
    get(`${BASE}/${SEASON}/${round}/sprint.json`),
  ]);

  const race = resJ?.MRData?.RaceTable?.Races?.[0];
  if (!race) return null;

  const results = (race.Results ?? []).map(buildResultRow);

  const qResults = qJ?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
  const qByNum = new Map();
  for (const q of qResults) qByNum.set(Number(q.number), Number(q.position));
  for (const r of results) {
    const qp = qByNum.get(r.driverNumber);
    if (qp) r.qualiPosition = qp;
  }

  const sp = spJ?.MRData?.RaceTable?.Races?.[0];
  const sprintResults = sp?.SprintResults?.map(buildResultRow);

  return {
    round: Number(race.round),
    raceName: race.raceName,
    date: race.date,
    country: race.Circuit?.Location?.country,
    locality: race.Circuit?.Location?.locality,
    hasSprint: !!sprintResults && sprintResults.length > 0,
    results,
    sprintResults: sprintResults ?? null,
  };
}

async function main() {
  console.log(`Season ${SEASON}, last ${ROUNDS} rounds`);
  await mkdir(dirname(OUT), { recursive: true });

  const schedule = await fetchSchedule();
  console.log(`Schedule: ${schedule.length} rounds`);

  const today = new Date().toISOString().slice(0, 10);
  const past = schedule.filter((s) => s.date <= today);
  const targets = past.slice(-ROUNDS);
  console.log(`Past rounds: ${past.length}, fetching: ${targets.length}`);

  const rounds = [];
  for (const t of targets) {
    process.stdout.write(`  R${t.round} ${t.country}… `);
    try {
      const data = await fetchRound(t.round);
      if (data) {
        rounds.push(data);
        console.log(`${data.results.length} drivers${data.hasSprint ? " + sprint" : ""}`);
      } else {
        console.log("no data");
      }
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
  }

  const out = {
    generated: new Date().toISOString(),
    season: SEASON,
    schedule,
    rounds,
  };
  await writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote ${OUT} (${rounds.length} rounds, ${(JSON.stringify(out).length / 1024).toFixed(0)}KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
