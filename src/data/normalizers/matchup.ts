// src/data/normalizers/matchup.ts
import { OasisMatchup, VegasTeamLine } from "../interfaces";

export function mergeMatchup(oasis: OasisMatchup, vegas: Partial<VegasTeamLine>) {
  return {
    defRankVsPos: oasis?.defRankVsPos ?? 16,
    oasisMatchupScore: oasis?.oasisMatchupScore ?? 50,
    olHealthIndex: oasis?.olHealthIndex ?? 60,
    impliedTeamTotal: vegas?.impliedTeamTotal ?? 22.5,
    weatherImpact: typeof vegas?.weatherImpact === "number" ? vegas!.weatherImpact : 0,
  };
}