export type MetricScope = "play" | "week" | "season" | "game";
export type MetricSide = "offense" | "defense" | "special_teams";
export type PositionGroup = "QB" | "RB" | "WR" | "TE" | "ALL";
export type MetricFamily = "volume" | "efficiency" | "value" | "expected" | "composite" | "situational" | "identity";

export interface MetricDefinition {
  key: string;
  label: string;
  shortLabel?: string;
  description: string;
  family: MetricFamily;
  scope: MetricScope[];
  side: MetricSide;
  positions: PositionGroup[];
  format: "number" | "pct" | "decimal" | "rate";
  decimals?: number;
  higherIsBetter?: boolean;
  module: string[];
}

export const METRIC_REGISTRY: MetricDefinition[] = [
  // ─── IDENTITY ───
  { key: "snaps", label: "Snaps", description: "Total offensive snaps played", family: "volume", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", higherIsBetter: true, module: ["snapshots"] },
  { key: "snapShare", label: "Snap Share", description: "Percentage of team offensive snaps", family: "volume", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["snapshots"] },
  { key: "routes", label: "Routes Run", description: "Total pass routes run", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["snapshots", "receiving"] },
  { key: "routeRate", label: "Route Rate", description: "Routes run as % of pass plays", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "pct", higherIsBetter: true, module: ["snapshots", "receiving"] },

  // ─── RECEIVING ───
  { key: "targets", label: "Targets", description: "Pass targets received", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "targetShare", label: "Target Share", description: "Percentage of team targets", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "pct", higherIsBetter: true, module: ["receiving"] },
  { key: "receptions", label: "Receptions", description: "Completed catches", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "recYards", label: "Receiving Yards", description: "Total receiving yards", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "recTds", label: "Receiving TDs", description: "Receiving touchdowns", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "aDot", label: "aDOT", shortLabel: "aDOT", description: "Average depth of target — how far downfield targets travel", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 1, higherIsBetter: undefined, module: ["receiving"] },
  { key: "airYards", label: "Air Yards", description: "Total intended air yards on targets", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "yac", label: "YAC", description: "Yards after catch", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "catchRate", label: "Catch Rate", description: "Receptions / targets", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: true, module: ["receiving"] },
  { key: "yardsPerTarget", label: "Yards/Target", description: "Receiving yards per target", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["receiving"] },
  { key: "racr", label: "RACR", description: "Receiver Air Conversion Ratio (rec yards / air yards)", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "wopr", label: "WOPR", description: "Weighted Opportunity Rating (target share + air yard share blend)", family: "composite", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "slotRate", label: "Slot Rate", description: "Percentage of routes from the slot", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: undefined, module: ["receiving"] },
  { key: "inlineRate", label: "Inline Rate", description: "Percentage of routes from inline (TE-specific)", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["TE"], format: "pct", higherIsBetter: undefined, module: ["receiving"] },
  { key: "avgAirEpa", label: "Target EPA", description: "Average EPA of targets before catch (target quality)", family: "value", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "avgCompAirEpa", label: "Completed Target EPA", description: "Average air EPA on completions only", family: "value", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "deepTargetRate", label: "Deep Target %", description: "Targets with air yards >= 20", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: undefined, module: ["receiving"] },
  { key: "intermediateTargetRate", label: "Intermediate Target %", description: "Targets with air yards 10-19", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: undefined, module: ["receiving"] },
  { key: "shortTargetRate", label: "Short Target %", description: "Targets with air yards < 10", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: undefined, module: ["receiving"] },
  { key: "leftTargetRate", label: "Left Target %", description: "Targets to the left side", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", module: ["receiving"] },
  { key: "middleTargetRate", label: "Middle Target %", description: "Targets to the middle", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", module: ["receiving"] },
  { key: "rightTargetRate", label: "Right Target %", description: "Targets to the right side", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", module: ["receiving"] },

  // ─── ADVANCED EFFICIENCY (receiving + general) ───
  { key: "tprr", label: "TPRR", description: "Targets per route run", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "yprr", label: "YPRR", description: "Yards per route run", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "epaPerPlay", label: "EPA/Play", description: "Expected points added per play", family: "value", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["snapshots", "receiving", "rushing", "qb"] },
  { key: "epaPerTarget", label: "EPA/Target", description: "Expected points added per target", family: "value", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "successRate", label: "Success Rate", description: "Percentage of plays meeting yardage threshold by down", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["snapshots", "receiving", "rushing", "qb"] },

  // ─── xYAC (Expected YAC) ───
  { key: "xYac", label: "xYAC", description: "Expected yards after catch per reception", family: "expected", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["receiving"] },
  { key: "yacOverExpected", label: "YAC Over Expected", description: "Actual YAC minus expected YAC per reception", family: "expected", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["receiving"] },
  { key: "xYacSuccessRate", label: "xYAC Beat %", description: "Percentage of receptions exceeding expected YAC", family: "expected", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "pct", higherIsBetter: true, module: ["receiving"] },

  // ─── RB RECEIVING ───
  { key: "yacPerRec", label: "YAC/Rec", description: "Yards after catch per reception", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["receiving", "rushing"] },
  { key: "recFirstDowns", label: "Rec First Downs", description: "First downs via reception", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB", "WR", "TE"], format: "number", higherIsBetter: true, module: ["receiving"] },
  { key: "firstDownsPerRoute", label: "1D/Route", description: "Receiving first downs per route run", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },
  { key: "fptsPerRoute", label: "FPTS/Route", description: "PPR fantasy points per route run", family: "composite", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["receiving"] },

  // ─── RUSHING ───
  { key: "rushAttempts", label: "Rush Attempts", description: "Total rushing attempts", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB", "QB"], format: "number", higherIsBetter: true, module: ["rushing"] },
  { key: "rushYards", label: "Rush Yards", description: "Total rushing yards", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB", "QB"], format: "number", higherIsBetter: true, module: ["rushing"] },
  { key: "rushTds", label: "Rush TDs", description: "Rushing touchdowns", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB", "QB"], format: "number", higherIsBetter: true, module: ["rushing"] },
  { key: "yardsPerCarry", label: "YPC", description: "Yards per carry", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB", "QB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["rushing"] },
  { key: "rushEpaPerPlay", label: "Rush EPA/Play", description: "EPA per rushing play", family: "value", scope: ["week", "season"], side: "offense", positions: ["RB", "QB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["rushing"] },
  { key: "stuffed", label: "Stuffed", description: "Tackles for loss count", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", higherIsBetter: false, module: ["rushing"] },
  { key: "stuffRate", label: "Stuff Rate", description: "TFL / rush attempts", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: false, module: ["rushing"] },
  { key: "rushFirstDowns", label: "Rush 1st Downs", description: "First downs via rushing", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", higherIsBetter: true, module: ["rushing"] },
  { key: "rushFirstDownRate", label: "Rush 1D Rate", description: "Rush first downs / attempts", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: true, module: ["rushing"] },
  { key: "insideRunRate", label: "Inside Run %", description: "Runs through guard/tackle gaps", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", module: ["rushing"] },
  { key: "outsideRunRate", label: "Outside Run %", description: "Runs to the edge/outside", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", module: ["rushing"] },
  { key: "insideSuccessRate", label: "Inside Success %", description: "Success rate on inside runs", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: true, module: ["rushing"] },
  { key: "outsideSuccessRate", label: "Outside Success %", description: "Success rate on outside runs", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: true, module: ["rushing"] },
  { key: "leftRunRate", label: "Left Run %", description: "Runs to the left", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", module: ["rushing"] },
  { key: "middleRunRate", label: "Middle Run %", description: "Runs up the middle", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", module: ["rushing"] },
  { key: "rightRunRate", label: "Right Run %", description: "Runs to the right", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", module: ["rushing"] },

  // ─── QB PASSING ───
  { key: "cpoe", label: "CPOE", description: "Completion percentage over expected", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["qb"] },
  { key: "dropbacks", label: "Dropbacks", description: "Total dropbacks (pass attempts + sacks)", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: true, module: ["qb"] },
  { key: "anyA", label: "ANY/A", description: "Adjusted Net Yards/Attempt", family: "composite", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["qb"] },
  { key: "fpPerDropback", label: "FP/Dropback", description: "Fantasy points per dropback", family: "composite", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "decimal", decimals: 2, higherIsBetter: true, module: ["qb"] },
  { key: "sacks", label: "Sacks", description: "Times sacked", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: false, module: ["qb"] },
  { key: "sackRate", label: "Sack Rate", description: "Sacks / dropbacks", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: false, module: ["qb"] },
  { key: "sackYards", label: "Sack Yards", description: "Yards lost to sacks", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: false, module: ["qb"] },
  { key: "qbHits", label: "QB Hits", description: "Times hit by defender", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: false, module: ["qb"] },
  { key: "qbHitRate", label: "QB Hit Rate", description: "QB hits / dropbacks (pressure proxy)", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: false, module: ["qb"] },
  { key: "scrambles", label: "Scrambles", description: "Designed or improvised QB scrambles", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", module: ["qb"] },
  { key: "scrambleYards", label: "Scramble Yards", description: "Yards gained on scrambles", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: true, module: ["qb"] },
  { key: "scrambleTds", label: "Scramble TDs", description: "Touchdowns on scrambles", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: true, module: ["qb"] },
  { key: "passFirstDowns", label: "Pass 1st Downs", description: "First downs via passing", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: true, module: ["qb"] },
  { key: "passFirstDownRate", label: "Pass 1D Rate", description: "Passing first down rate", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: true, module: ["qb"] },
  { key: "deepPassAttempts", label: "Deep Attempts", description: "Passes with air yards > 20", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", module: ["qb"] },
  { key: "deepPassRate", label: "Deep Pass %", description: "Deep passes / total attempts", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", module: ["qb"] },
  { key: "passAdot", label: "Pass aDOT", description: "Average depth of target (passer)", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "decimal", decimals: 1, module: ["qb"] },
  { key: "shotgunRate", label: "Shotgun %", description: "Plays from shotgun formation", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", module: ["qb"] },
  { key: "noHuddleRate", label: "No Huddle %", description: "Plays in no-huddle offense", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", module: ["qb"] },
  { key: "shotgunSuccessRate", label: "Shotgun Success %", description: "Success rate from shotgun", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: true, module: ["qb"] },
  { key: "underCenterSuccessRate", label: "Under Center Success %", description: "Success rate under center", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: true, module: ["qb"] },

  // ─── RED ZONE ───
  { key: "rzSnaps", label: "RZ Snaps", description: "Snaps inside opponent 20-yard line", family: "volume", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzSnapRate", label: "RZ Snap Rate", description: "% of team RZ snaps on field", family: "volume", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzSuccessRate", label: "RZ Success Rate", description: "Success rate on red zone plays", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzTargets", label: "RZ Targets", description: "Targets inside opponent 20", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzReceptions", label: "RZ Receptions", description: "Receptions in red zone", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzRecTds", label: "RZ Rec TDs", description: "Receiving TDs in red zone", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE", "RB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzTargetShare", label: "RZ Target Share", description: "% of team RZ targets", family: "volume", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzCatchRate", label: "RZ Catch Rate", description: "Catch rate in red zone (high pressure)", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzRushAttempts", label: "RZ Rush Attempts", description: "Red zone rushing attempts", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzRushTds", label: "RZ Rush TDs", description: "Red zone rushing touchdowns", family: "volume", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzRushTdRate", label: "RZ Rush TD Rate", description: "TD rate on RZ rushes", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzPassAttempts", label: "RZ Pass Attempts", description: "Pass attempts in red zone", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", module: ["redzone"] },
  { key: "rzPassTds", label: "RZ Pass TDs", description: "Passing TDs in red zone", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: true, module: ["redzone"] },
  { key: "rzTdRate", label: "RZ TD Rate", description: "TD rate in red zone", family: "efficiency", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "pct", higherIsBetter: true, module: ["redzone"] },
  { key: "rzInterceptions", label: "RZ INTs", description: "Interceptions in red zone", family: "volume", scope: ["week", "season"], side: "offense", positions: ["QB"], format: "number", higherIsBetter: false, module: ["redzone"] },

  // ─── SITUATIONAL ───
  { key: "thirdDownSnaps", label: "3rd Down Snaps", description: "Snaps on 3rd down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", module: ["situational"] },
  { key: "thirdDownConversions", label: "3rd Down Conversions", description: "3rd downs converted", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "thirdDownConversionRate", label: "3rd Down Conv %", description: "Conversion rate on 3rd down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "earlyDownSuccessRate", label: "Early Down Success %", description: "Success rate on 1st/2nd down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "lateDownSuccessRate", label: "Late Down Success %", description: "Success rate on 3rd/4th down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "shortYardageAttempts", label: "Short Yardage Attempts", description: "Rush attempts on 3rd/4th & <= 2 yards", family: "situational", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", module: ["situational"] },
  { key: "shortYardageConversions", label: "Short Yardage Conversions", description: "Short yardage conversions", family: "situational", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "shortYardageRate", label: "Short Yardage Conv %", description: "Conversion rate in short yardage", family: "situational", scope: ["week", "season"], side: "offense", positions: ["RB"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "thirdDownTargets", label: "3rd Down Targets", description: "Targets on 3rd down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "number", module: ["situational"] },
  { key: "thirdDownReceptions", label: "3rd Down Receptions", description: "Receptions on 3rd down", family: "situational", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "thirdDownRecConversions", label: "3rd Down Rec Conversions", description: "3rd down receptions resulting in conversions", family: "situational", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "twoMinuteSnaps", label: "2-Min Snaps", description: "Snaps in final 2 minutes of half", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", module: ["situational"] },
  { key: "twoMinuteSuccessful", label: "2-Min Successful", description: "Successful plays in 2-minute drill", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "twoMinuteSuccessRate", label: "2-Min Success %", description: "Success rate in 2-minute drill", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "hurryUpSnaps", label: "Hurry-Up Snaps", description: "Snaps in no-huddle/hurry-up offense", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", module: ["situational"] },
  { key: "hurryUpSuccessful", label: "Hurry-Up Successful", description: "Successful plays in hurry-up", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "number", higherIsBetter: true, module: ["situational"] },
  { key: "hurryUpSuccessRate", label: "Hurry-Up Success %", description: "Success rate in hurry-up", family: "situational", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "pct", higherIsBetter: true, module: ["situational"] },
  { key: "twoMinuteTargets", label: "2-Min Targets", description: "Targets in 2-minute drill", family: "situational", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "number", module: ["situational"] },
  { key: "twoMinuteReceptions", label: "2-Min Receptions", description: "Receptions in 2-minute drill", family: "situational", scope: ["week", "season"], side: "offense", positions: ["WR", "TE"], format: "number", higherIsBetter: true, module: ["situational"] },

  // ─── FANTASY POINTS ───
  { key: "fptsStd", label: "FPTS (Std)", description: "Standard scoring fantasy points", family: "composite", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["snapshots"] },
  { key: "fptsHalf", label: "FPTS (Half)", description: "Half-PPR scoring fantasy points", family: "composite", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["snapshots"] },
  { key: "fptsPpr", label: "FPTS (PPR)", description: "PPR scoring fantasy points", family: "composite", scope: ["week", "season"], side: "offense", positions: ["ALL"], format: "decimal", decimals: 1, higherIsBetter: true, module: ["snapshots"] },
];

export function getMetricsForModule(moduleName: string): MetricDefinition[] {
  return METRIC_REGISTRY.filter(m => m.module.includes(moduleName));
}

export function getMetricsForPosition(position: PositionGroup): MetricDefinition[] {
  return METRIC_REGISTRY.filter(m => m.positions.includes(position) || m.positions.includes("ALL"));
}

export function getMetricsForModuleAndPosition(moduleName: string, position: PositionGroup): MetricDefinition[] {
  return METRIC_REGISTRY.filter(m =>
    m.module.includes(moduleName) &&
    (m.positions.includes(position) || m.positions.includes("ALL"))
  );
}

export function formatMetricValue(value: number | null | undefined, def: MetricDefinition): string {
  if (value === null || value === undefined) return "—";
  const decimals = def.decimals ?? (def.format === "decimal" ? 2 : def.format === "pct" ? 1 : 0);
  if (def.format === "pct") return `${(value * 100).toFixed(decimals)}%`;
  if (def.format === "decimal" || def.format === "rate") return value.toFixed(decimals);
  return String(Math.round(value));
}

export interface ModuleDefinition {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  positions: PositionGroup[];
  side: MetricSide;
  color: string;
  badge?: string;
  metricCount?: number;
}

export const MODULE_CATALOG: ModuleDefinition[] = [
  { id: "snapshots", title: "Snapshots", subtitle: "Raw Data Spine", description: "Per-week and season player data explorer with usage, efficiency, and fantasy point metrics.", path: "/tiber-data-lab/snapshots", positions: ["ALL"], side: "offense", color: "#e2640d" },
  { id: "personnel", title: "Personnel Groupings", subtitle: "Formation Intelligence", description: "Every-down grades and personnel breakdown percentages across 10-22 packages.", path: "/tiber-data-lab/personnel", positions: ["ALL"], side: "offense", color: "#0891b2", badge: "NEW" },
  { id: "role-banks", title: "Role Banks", subtitle: "Positional Archetypes", description: "Season-level role classification and archetype mapping for all skill positions.", path: "/tiber-data-lab/role-banks", positions: ["ALL"], side: "offense", color: "#059669" },
  { id: "receiving", title: "Receiving Lab", subtitle: "Target & Efficiency Analysis", description: "Targets, air yards, xYAC, catch rate, RACR, WOPR, target depth/location distribution, and EPA per target.", path: "/tiber-data-lab/receiving", positions: ["WR", "TE", "RB"], side: "offense", color: "#7c3aed", badge: "NEW" },
  { id: "rushing", title: "Rushing Lab", subtitle: "Ground Game Intelligence", description: "Rush EPA, stuff rate, gap/location distribution, short yardage efficiency, and first-down conversion.", path: "/tiber-data-lab/rushing", positions: ["RB", "QB"], side: "offense", color: "#16a34a", badge: "NEW" },
  { id: "qb", title: "QB Lab", subtitle: "Passing Value & Process", description: "CPOE, ANY/A, air EPA, formation tendencies, pressure rates, and dropback efficiency.", path: "/tiber-data-lab/qb", positions: ["QB"], side: "offense", color: "#9333ea", badge: "NEW" },
  { id: "redzone", title: "Red Zone Lab", subtitle: "Scoring Opportunity Analysis", description: "RZ snaps, targets, TDs, success rate, and scoring efficiency inside the opponent 20.", path: "/tiber-data-lab/red-zone", positions: ["ALL"], side: "offense", color: "#dc2626", badge: "NEW" },
  { id: "situational", title: "Situational Lab", subtitle: "Context-Dependent Performance", description: "3rd down, two-minute drill, hurry-up, early/late down splits across all positions.", path: "/tiber-data-lab/situational", positions: ["ALL"], side: "offense", color: "#ca8a04", badge: "NEW" },
];
