"use client";

import { useMemo } from "react";
import type { FormFile } from "../lib/form";
import { computeProjections } from "../lib/form";
import { usePersisted } from "../lib/persisted";
import { Optimizer } from "./Optimizer";
import { Builder } from "./Builder";
import { ValueBoard } from "./ValueBoard";
import { Compare } from "./Compare";
import { Hindsight } from "./Hindsight";
import { Transfers } from "./Transfers";
import { LastRaceScore } from "./LastRaceScore";
import { PriceTrends } from "./PriceTrends";
import { PopularPicks } from "./PopularPicks";
import { emptyLineup, type LineupState } from "./LineupBar";
import {
  CalculatorIcon,
  CrownIcon,
  DiamondIcon,
  DollarIcon,
  LiveIcon,
  LogoIcon,
  MoonIcon,
  MoreIcon,
  RewindIcon,
  SwapIcon,
  BarsIcon,
  BookmarkIcon,
  UserIcon,
} from "./Icons";

type IconProps = React.SVGProps<SVGSVGElement>;

const TABS: {
  id: TabId;
  label: string;
  desc: string;
  Icon: (p: IconProps) => React.ReactElement;
  premium?: boolean;
  hasLive?: boolean;
}[] = [
  { id: "team",      label: "Pick team",       desc: "Build a 5-driver, 2-constructor squad within budget.",  Icon: BookmarkIcon },
  { id: "optimize",  label: "Best teams",      desc: "Optimal lineups with chip and constraint controls.",     Icon: CalculatorIcon },
  { id: "prices",    label: "Price moves",     desc: "Predicted next-round price changes.",                    Icon: DollarIcon },
  { id: "live",      label: "Race score",      desc: "Your lineup's score for the most recent round.",          Icon: LiveIcon, hasLive: true },
  { id: "transfers", label: "Transfers",       desc: "Single swaps that improve projected points.",            Icon: SwapIcon },
  { id: "popular",   label: "Consensus picks", desc: "Assets the optimizer keeps even when constraints change.",Icon: CrownIcon },
  { id: "stats",     label: "Statistics",      desc: "Every driver and constructor, sortable on every column.",Icon: BarsIcon },
  { id: "hindsight", label: "Hindsight",       desc: "Best possible lineup for each completed round.",          Icon: RewindIcon },
  { id: "saved",     label: "Saved teams",     desc: "Browser-stored lineups for side-by-side comparison.",    Icon: DiamondIcon, premium: true },
];

type TabId =
  | "team"
  | "optimize"
  | "prices"
  | "live"
  | "transfers"
  | "popular"
  | "stats"
  | "hindsight"
  | "saved";

const STORE_KEY = "f1fantasy:current";
const TAB_KEY = "f1fantasy:tab";

export function Shell({ form }: { form: FormFile }) {
  const proj = computeProjections(form);

  // Persisted to localStorage; SSR-safe via useSyncExternalStore (see usePersisted).
  const emptyFallback = useMemo(() => emptyLineup(), []);
  const [lineup, setLineup] = usePersisted<LineupState>(STORE_KEY, emptyFallback);
  const [storedTab, setTab] = usePersisted<TabId>(TAB_KEY, "optimize");
  const tab: TabId = TABS.some((x) => x.id === storedTab) ? storedTab : "optimize";

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar tab={tab} setTab={setTab} />
      <main className="flex-1 min-w-0 px-6 py-6">
        <div key={tab} className="page-in">
          {tab === "team" && <Builder proj={proj} state={lineup} setState={setLineup} />}
          {tab === "optimize" && <Optimizer proj={proj} setLineup={setLineup} />}
          {tab === "prices" && <PriceTrends proj={proj} />}
          {tab === "live" && <LastRaceScore proj={proj} state={lineup} />}
          {tab === "transfers" && (
            <Transfers proj={proj} state={lineup} setState={setLineup} />
          )}
          {tab === "popular" && <PopularPicks proj={proj} />}
          {tab === "stats" && <ValueBoard proj={proj} />}
          {tab === "hindsight" && <Hindsight proj={proj} />}
          {tab === "saved" && (
            <Compare proj={proj} current={lineup} setLineup={setLineup} />
          )}
        </div>
      </main>
    </div>
  );
}

function Sidebar({
  tab,
  setTab,
}: {
  tab: TabId;
  setTab: (t: TabId) => void;
}) {
  return (
    <aside className="w-[68px] shrink-0 flex flex-col items-center py-4 gap-1 border-r border-white/[0.04]">
      <button
        className="side-icon mb-3 text-[#e1252c]"
        title="F1 Fantasy Lab"
        style={{ color: "#e1252c" }}
      >
        <LogoIcon width={22} height={22} />
      </button>

      {TABS.map((t) => {
        const isActive = tab === t.id;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-tip={t.label}
            className={`side-icon ${isActive ? "active" : ""} ${t.premium ? "premium" : ""}`}
            aria-label={t.label}
          >
            <Icon />
            {t.hasLive && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#34d39a] pulse-dot" />
            )}
          </button>
        );
      })}

      <button
        className="side-icon mt-1"
        title="More"
        aria-label="More tools"
      >
        <MoreIcon />
      </button>

      <div className="flex-1" />

      <button
        className="side-icon"
        title="Profile"
        aria-label="Profile"
      >
        <UserIcon />
      </button>
      <button
        className="side-icon"
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        <MoonIcon />
      </button>
    </aside>
  );
}
