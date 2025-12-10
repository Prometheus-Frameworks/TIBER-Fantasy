// src/data/normalizers/matchup.ts
import { EnvironmentMatchup, VegasTeamLine } from "../interfaces";

export function mergeMatchup(oasis: EnvironmentMatchup, vegas: Partial<VegasTeamLine>) {
  return {
    defRankVsPos: oasis?.defRankVsPos ?? 16,
    oasisMatchupScore: oasis?.oasisMatchupScore ?? 50,
    olHealthIndex: oasis?.olHealthIndex ?? 60,
    impliedTeamTotal: vegas?.impliedTeamTotal ?? 22.5,
    weatherImpact: typeof vegas?.weatherImpact === "number" ? vegas!.weatherImpact : 0,
    opponent: vegas?.opponent, // pass through opponent for reasoning
  };
}