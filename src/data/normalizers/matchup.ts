// src/data/normalizers/matchup.ts
import { OasisMatchup, VegasTeamLine } from "../interfaces";

export function mergeMatchup(oasis: OasisMatchup, vegas: Partial<VegasTeamLine>) {
  return {
    defRankVsPos: oasis.defRankVsPos,
    oasisMatchupScore: oasis.oasisMatchupScore,
    olHealthIndex: oasis.olHealthIndex,
    impliedTeamTotal: vegas.impliedTeamTotal,
    weatherImpact: vegas.weatherImpact,
  };
}