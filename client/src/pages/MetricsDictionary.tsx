import { useState, useEffect, useMemo } from "react";
import { Search, Database, Filter } from "lucide-react";

type DataType = "int" | "rate" | "pct" | "float" | "count";
type Scope = "weekly" | "season" | "both";
type Position = "QB" | "RB" | "WR" | "TE";

interface Metric {
  variable: string;
  dbColumn: string;
  label: string;
  description: string;
  positions: Position[];
  dataType: DataType;
  scope: Scope;
  category: string;
  forgeRelevance?: string;
}

const CATEGORIES = [
  "Usage",
  "Receiving",
  "Receiving Efficiency",
  "Receiving Distribution",
  "Rushing",
  "Rushing Efficiency",
  "Rushing Distribution",
  "EPA & Advanced",
  "Expected YAC",
  "Red Zone",
  "Down & Distance",
  "Two-Minute & Hurry-Up",
  "QB Passing",
  "QB Advanced",
  "Fantasy Points",
] as const;

const metrics: Metric[] = [
  { variable: "snaps", dbColumn: "snaps", label: "Snaps", description: "Total offensive snaps played", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "both", category: "Usage", forgeRelevance: "Volume pillar — base workload signal" },
  { variable: "snapShare", dbColumn: "snap_share", label: "Snap Share", description: "Percentage of team offensive snaps the player was on field (0-1)", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "both", category: "Usage", forgeRelevance: "Volume pillar — primary usage indicator" },
  { variable: "routes", dbColumn: "routes", label: "Routes Run", description: "Total pass routes run (receiving snaps)", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Usage", forgeRelevance: "Volume pillar — pass game involvement" },
  { variable: "routeRate", dbColumn: "route_rate", label: "Route Rate", description: "Routes run as a percentage of pass plays (routes / team pass plays)", positions: ["RB","WR","TE"], dataType: "rate", scope: "both", category: "Usage" },

  { variable: "targets", dbColumn: "targets", label: "Targets", description: "Total pass targets received", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving", forgeRelevance: "Volume pillar — opportunity count" },
  { variable: "targetShare", dbColumn: "target_share", label: "Target Share", description: "Percentage of team targets directed to this player (0-1)", positions: ["RB","WR","TE"], dataType: "rate", scope: "both", category: "Receiving", forgeRelevance: "Volume pillar — target dominance" },
  { variable: "receptions", dbColumn: "receptions", label: "Receptions", description: "Total completed receptions", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving" },
  { variable: "recYards", dbColumn: "rec_yards", label: "Receiving Yards", description: "Total receiving yards", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving" },
  { variable: "recTds", dbColumn: "rec_tds", label: "Receiving TDs", description: "Total receiving touchdowns", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving" },
  { variable: "aDot", dbColumn: "adot", label: "aDOT", description: "Average Depth of Target — how deep the player is targeted downfield", positions: ["RB","WR","TE"], dataType: "float", scope: "both", category: "Receiving", forgeRelevance: "Efficiency pillar — route depth context" },
  { variable: "airYards", dbColumn: "air_yards", label: "Air Yards", description: "Total air yards on all targets (before catch)", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving" },
  { variable: "yac", dbColumn: "yac", label: "YAC", description: "Yards After Catch — total yards gained after the reception", positions: ["RB","WR","TE"], dataType: "int", scope: "both", category: "Receiving" },

  { variable: "tprr", dbColumn: "tprr", label: "TPRR", description: "Targets Per Route Run — measures how often a player is targeted relative to routes run", positions: ["RB","WR","TE"], dataType: "rate", scope: "both", category: "Receiving Efficiency", forgeRelevance: "Efficiency pillar — route-level demand" },
  { variable: "yprr", dbColumn: "yprr", label: "YPRR", description: "Yards Per Route Run — receiving yards divided by routes run, the gold standard efficiency metric", positions: ["RB","WR","TE"], dataType: "rate", scope: "both", category: "Receiving Efficiency", forgeRelevance: "Efficiency pillar — core WR/TE efficiency" },
  { variable: "catchRate", dbColumn: "catch_rate", label: "Catch Rate", description: "Receptions divided by targets (percentage)", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Efficiency" },
  { variable: "yardsPerTarget", dbColumn: "yards_per_target", label: "Yards/Target", description: "Receiving yards divided by targets", positions: ["WR","TE"], dataType: "float", scope: "weekly", category: "Receiving Efficiency" },
  { variable: "racr", dbColumn: "racr", label: "RACR", description: "Receiver Air Conversion Ratio — receiving yards divided by air yards (measures how well a player converts air yards into actual yards)", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Efficiency", forgeRelevance: "Efficiency pillar — air yard conversion" },
  { variable: "wopr", dbColumn: "wopr", label: "WOPR", description: "Weighted Opportunity Rating — combines target share and air yard share into one number", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Efficiency", forgeRelevance: "Volume pillar — composite opportunity" },
  { variable: "avgAirEpa", dbColumn: "avg_air_epa", label: "Avg Air EPA", description: "Average EPA of targets before the catch — measures target quality from the QB", positions: ["WR","TE"], dataType: "float", scope: "weekly", category: "Receiving Efficiency" },
  { variable: "avgCompAirEpa", dbColumn: "avg_comp_air_epa", label: "Avg Comp Air EPA", description: "Average air EPA on completions only", positions: ["WR","TE"], dataType: "float", scope: "weekly", category: "Receiving Efficiency" },

  { variable: "slotRate", dbColumn: "slot_rate", label: "Slot Rate", description: "Percentage of routes run from the slot", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "inlineRate", dbColumn: "inline_rate", label: "Inline Rate", description: "Percentage of routes from inline position (TE-specific)", positions: ["TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "deepTargetRate", dbColumn: "deep_target_rate", label: "Deep Target Rate", description: "Percentage of targets with air yards >= 20", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "intermediateTargetRate", dbColumn: "intermediate_target_rate", label: "Intermediate Target Rate", description: "Percentage of targets with air yards 10-19", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "shortTargetRate", dbColumn: "short_target_rate", label: "Short Target Rate", description: "Percentage of targets with air yards < 10", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "leftTargetRate", dbColumn: "left_target_rate", label: "Left Target Rate", description: "Percentage of targets to the left side of field", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "middleTargetRate", dbColumn: "middle_target_rate", label: "Middle Target Rate", description: "Percentage of targets to the middle of field", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },
  { variable: "rightTargetRate", dbColumn: "right_target_rate", label: "Right Target Rate", description: "Percentage of targets to the right side of field", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Receiving Distribution" },

  { variable: "rushAttempts", dbColumn: "rush_attempts", label: "Rush Attempts", description: "Total rushing attempts", positions: ["QB","RB"], dataType: "int", scope: "both", category: "Rushing", forgeRelevance: "Volume pillar — RB workload" },
  { variable: "rushYards", dbColumn: "rush_yards", label: "Rush Yards", description: "Total rushing yards", positions: ["QB","RB"], dataType: "int", scope: "both", category: "Rushing" },
  { variable: "rushTds", dbColumn: "rush_tds", label: "Rush TDs", description: "Total rushing touchdowns", positions: ["QB","RB"], dataType: "int", scope: "both", category: "Rushing" },
  { variable: "yardsPerCarry", dbColumn: "yards_per_carry", label: "YPC", description: "Yards Per Carry — rushing yards divided by rush attempts", positions: ["QB","RB"], dataType: "float", scope: "both", category: "Rushing", forgeRelevance: "Efficiency pillar — rush efficiency" },

  { variable: "rushEpaPerPlay", dbColumn: "rush_epa_per_play", label: "Rush EPA/Play", description: "EPA per rushing play — measures efficiency of each rush", positions: ["QB","RB"], dataType: "float", scope: "both", category: "Rushing Efficiency", forgeRelevance: "Efficiency pillar — advanced rush value" },
  { variable: "stuffed", dbColumn: "stuffed", label: "Stuffed (TFL)", description: "Number of tackles for loss / stuffed runs", positions: ["RB"], dataType: "int", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "stuffRate", dbColumn: "stuff_rate", label: "Stuff Rate", description: "TFL count divided by rush attempts (lower is better)", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "rushFirstDowns", dbColumn: "rush_first_downs", label: "Rush First Downs", description: "First downs gained on rushing plays", positions: ["RB"], dataType: "int", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "rushFirstDownRate", dbColumn: "rush_first_down_rate", label: "Rush 1st Down Rate", description: "Percentage of rushes that result in a first down", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "yacPerRec", dbColumn: "yac_per_rec", label: "YAC/Reception", description: "Yards after catch per reception (RB receiving efficiency)", positions: ["RB"], dataType: "float", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "recFirstDowns", dbColumn: "rec_first_downs", label: "Rec First Downs", description: "First downs gained on receptions", positions: ["RB"], dataType: "int", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "firstDownsPerRoute", dbColumn: "first_downs_per_route", label: "1st Downs/Route", description: "Receiving first downs divided by routes run", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Efficiency" },
  { variable: "fptsPerRoute", dbColumn: "fpts_per_route", label: "FPTS/Route", description: "PPR fantasy points per route run (RB pass game value)", positions: ["RB"], dataType: "float", scope: "weekly", category: "Rushing Efficiency" },

  { variable: "insideRunRate", dbColumn: "inside_run_rate", label: "Inside Run Rate", description: "Percentage of runs through guard/tackle gaps", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "outsideRunRate", dbColumn: "outside_run_rate", label: "Outside Run Rate", description: "Percentage of runs to the outside/end", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "insideSuccessRate", dbColumn: "inside_success_rate", label: "Inside Success Rate", description: "Success rate on inside runs", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "outsideSuccessRate", dbColumn: "outside_success_rate", label: "Outside Success Rate", description: "Success rate on outside runs", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "leftRunRate", dbColumn: "left_run_rate", label: "Left Run Rate", description: "Percentage of runs to the left", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "middleRunRate", dbColumn: "middle_run_rate", label: "Middle Run Rate", description: "Percentage of runs up the middle", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },
  { variable: "rightRunRate", dbColumn: "right_run_rate", label: "Right Run Rate", description: "Percentage of runs to the right", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Rushing Distribution" },

  { variable: "epaPerPlay", dbColumn: "epa_per_play", label: "EPA/Play", description: "Expected Points Added per play — the premier advanced efficiency metric", positions: ["QB","RB","WR","TE"], dataType: "float", scope: "both", category: "EPA & Advanced", forgeRelevance: "Efficiency pillar — core EPA signal" },
  { variable: "epaPerTarget", dbColumn: "epa_per_target", label: "EPA/Target", description: "Expected Points Added per target — receiving efficiency", positions: ["RB","WR","TE"], dataType: "float", scope: "both", category: "EPA & Advanced", forgeRelevance: "Efficiency pillar — target-level value" },
  { variable: "successRate", dbColumn: "success_rate", label: "Success Rate", description: "Percentage of plays that gained positive EPA (moved the team closer to scoring)", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "both", category: "EPA & Advanced", forgeRelevance: "Stability pillar — consistency measure" },

  { variable: "xYac", dbColumn: "x_yac", label: "xYAC", description: "Expected Yards After Catch per reception — model-predicted YAC based on catch location and situation", positions: ["RB","WR","TE"], dataType: "float", scope: "weekly", category: "Expected YAC" },
  { variable: "yacOverExpected", dbColumn: "yac_over_expected", label: "YAC Over Expected", description: "Actual YAC minus expected YAC per reception — positive means the player creates extra yards", positions: ["RB","WR","TE"], dataType: "float", scope: "weekly", category: "Expected YAC", forgeRelevance: "Efficiency pillar — playmaking ability" },
  { variable: "xYacSuccessRate", dbColumn: "x_yac_success_rate", label: "xYAC Success Rate", description: "Percentage of receptions where actual YAC exceeded expected YAC", positions: ["RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Expected YAC" },

  { variable: "rzSnaps", dbColumn: "rz_snaps", label: "RZ Snaps", description: "Snaps played inside the opponent's 20-yard line", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzSnapRate", dbColumn: "rz_snap_rate", label: "RZ Snap Rate", description: "Percentage of team's red zone snaps the player was on field", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Red Zone" },
  { variable: "rzSuccessRate", dbColumn: "rz_success_rate", label: "RZ Success Rate", description: "Success rate on red zone plays", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Red Zone" },
  { variable: "rzPassAttempts", dbColumn: "rz_pass_attempts", label: "RZ Pass Attempts", description: "Pass attempts in the red zone", positions: ["QB"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzPassTds", dbColumn: "rz_pass_tds", label: "RZ Pass TDs", description: "Passing touchdowns in the red zone", positions: ["QB"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzTdRate", dbColumn: "rz_td_rate", label: "RZ TD Rate", description: "TD rate in the red zone (TDs / attempts)", positions: ["QB"], dataType: "rate", scope: "weekly", category: "Red Zone" },
  { variable: "rzInterceptions", dbColumn: "rz_interceptions", label: "RZ INTs", description: "Interceptions thrown in the red zone", positions: ["QB"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzRushAttempts", dbColumn: "rz_rush_attempts", label: "RZ Rush Attempts", description: "Rush attempts in the red zone", positions: ["RB"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzRushTds", dbColumn: "rz_rush_tds", label: "RZ Rush TDs", description: "Rushing touchdowns in the red zone", positions: ["RB"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzRushTdRate", dbColumn: "rz_rush_td_rate", label: "RZ Rush TD Rate", description: "TD rate on red zone rushes", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Red Zone" },
  { variable: "rzTargets", dbColumn: "rz_targets", label: "RZ Targets", description: "Targets in the red zone", positions: ["RB","WR","TE"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzReceptions", dbColumn: "rz_receptions", label: "RZ Receptions", description: "Receptions in the red zone", positions: ["RB","WR","TE"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzRecTds", dbColumn: "rz_rec_tds", label: "RZ Rec TDs", description: "Receiving touchdowns in the red zone", positions: ["RB","WR","TE"], dataType: "int", scope: "weekly", category: "Red Zone" },
  { variable: "rzTargetShare", dbColumn: "rz_target_share", label: "RZ Target Share", description: "Percentage of team's red zone targets", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Red Zone", forgeRelevance: "Volume pillar — high-value opportunity" },
  { variable: "rzCatchRate", dbColumn: "rz_catch_rate", label: "RZ Catch Rate", description: "Catch rate in the red zone (high-pressure catches)", positions: ["WR","TE"], dataType: "rate", scope: "weekly", category: "Red Zone" },

  { variable: "thirdDownSnaps", dbColumn: "third_down_snaps", label: "3rd Down Snaps", description: "Snaps played on 3rd down", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "thirdDownConversions", dbColumn: "third_down_conversions", label: "3rd Down Conversions", description: "Third downs converted to first down or TD", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "thirdDownConversionRate", dbColumn: "third_down_conversion_rate", label: "3rd Down Conv Rate", description: "Conversion rate on 3rd down plays", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Down & Distance" },
  { variable: "earlyDownSuccessRate", dbColumn: "early_down_success_rate", label: "Early Down Success", description: "Success rate on 1st and 2nd down plays", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Down & Distance" },
  { variable: "lateDownSuccessRate", dbColumn: "late_down_success_rate", label: "Late Down Success", description: "Success rate on 3rd and 4th down plays", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Down & Distance" },
  { variable: "shortYardageAttempts", dbColumn: "short_yardage_attempts", label: "Short Yardage Attempts", description: "Rush attempts on 3rd/4th down with 2 or fewer yards to go", positions: ["RB"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "shortYardageConversions", dbColumn: "short_yardage_conversions", label: "Short Yardage Conv", description: "Conversions on short yardage situations", positions: ["RB"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "shortYardageRate", dbColumn: "short_yardage_rate", label: "Short Yardage Rate", description: "Conversion rate on short yardage plays", positions: ["RB"], dataType: "rate", scope: "weekly", category: "Down & Distance" },
  { variable: "thirdDownTargets", dbColumn: "third_down_targets", label: "3rd Down Targets", description: "Targets received on 3rd down", positions: ["WR","TE"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "thirdDownReceptions", dbColumn: "third_down_receptions", label: "3rd Down Receptions", description: "Receptions on 3rd down", positions: ["WR","TE"], dataType: "int", scope: "weekly", category: "Down & Distance" },
  { variable: "thirdDownRecConversions", dbColumn: "third_down_rec_conversions", label: "3rd Down Rec Conv", description: "Third down targets that resulted in conversions", positions: ["WR","TE"], dataType: "int", scope: "weekly", category: "Down & Distance" },

  { variable: "twoMinuteSnaps", dbColumn: "two_minute_snaps", label: "2-Minute Snaps", description: "Snaps in the final 2 minutes of each half", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "twoMinuteSuccessful", dbColumn: "two_minute_successful", label: "2-Minute Successful", description: "Successful plays in the 2-minute drill", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "twoMinuteSuccessRate", dbColumn: "two_minute_success_rate", label: "2-Minute Success Rate", description: "Success rate during the 2-minute drill", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "hurryUpSnaps", dbColumn: "hurry_up_snaps", label: "Hurry-Up Snaps", description: "Snaps in no-huddle / hurry-up offense", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "hurryUpSuccessful", dbColumn: "hurry_up_successful", label: "Hurry-Up Successful", description: "Successful plays in hurry-up offense", positions: ["QB","RB","WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "hurryUpSuccessRate", dbColumn: "hurry_up_success_rate", label: "Hurry-Up Success Rate", description: "Success rate in hurry-up offense", positions: ["QB","RB","WR","TE"], dataType: "rate", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "twoMinuteTargets", dbColumn: "two_minute_targets", label: "2-Minute Targets", description: "Targets in the 2-minute drill", positions: ["WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },
  { variable: "twoMinuteReceptions", dbColumn: "two_minute_receptions", label: "2-Minute Receptions", description: "Receptions in the 2-minute drill", positions: ["WR","TE"], dataType: "int", scope: "weekly", category: "Two-Minute & Hurry-Up" },

  { variable: "cpoe", dbColumn: "cpoe", label: "CPOE", description: "Completion Percentage Over Expected — how much better/worse than expected the QB completes passes", positions: ["QB"], dataType: "float", scope: "weekly", category: "QB Passing", forgeRelevance: "QB Context — accuracy signal" },
  { variable: "sacks", dbColumn: "sacks", label: "Sacks", description: "Times sacked", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Passing" },
  { variable: "sackRate", dbColumn: "sack_rate", label: "Sack Rate", description: "Sacks divided by dropbacks", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "qbHits", dbColumn: "qb_hits", label: "QB Hits", description: "Times hit by defenders", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Passing" },
  { variable: "qbHitRate", dbColumn: "qb_hit_rate", label: "QB Hit Rate", description: "QB hits divided by dropbacks (pressure proxy)", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "scrambles", dbColumn: "scrambles", label: "Scrambles", description: "QB scramble plays (designed or broken pocket)", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Passing" },
  { variable: "passFirstDowns", dbColumn: "pass_first_downs", label: "Pass First Downs", description: "First downs gained through passing", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Passing" },
  { variable: "passFirstDownRate", dbColumn: "pass_first_down_rate", label: "Pass 1st Down Rate", description: "First downs divided by pass attempts", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "deepPassAttempts", dbColumn: "deep_pass_attempts", label: "Deep Pass Attempts", description: "Pass attempts with air yards > 20", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Passing" },
  { variable: "deepPassRate", dbColumn: "deep_pass_rate", label: "Deep Pass Rate", description: "Deep pass attempts divided by total pass attempts", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "passAdot", dbColumn: "pass_adot", label: "Pass aDOT", description: "Average Depth of Target from the passer perspective", positions: ["QB"], dataType: "float", scope: "weekly", category: "QB Passing" },
  { variable: "shotgunRate", dbColumn: "shotgun_rate", label: "Shotgun Rate", description: "Percentage of plays from shotgun formation", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "noHuddleRate", dbColumn: "no_huddle_rate", label: "No Huddle Rate", description: "Percentage of plays in no-huddle", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "shotgunSuccessRate", dbColumn: "shotgun_success_rate", label: "Shotgun Success Rate", description: "Success rate from shotgun formation", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },
  { variable: "underCenterSuccessRate", dbColumn: "under_center_success_rate", label: "Under Center Success", description: "Success rate from under center formation", positions: ["QB"], dataType: "rate", scope: "weekly", category: "QB Passing" },

  { variable: "dropbacks", dbColumn: "dropbacks", label: "Dropbacks", description: "Total dropbacks (pass attempts + sacks)", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Advanced" },
  { variable: "sackYards", dbColumn: "sack_yards", label: "Sack Yards", description: "Yards lost due to sacks (negative value)", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Advanced" },
  { variable: "scrambleYards", dbColumn: "scramble_yards", label: "Scramble Yards", description: "Yards gained on QB scrambles", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Advanced" },
  { variable: "scrambleTds", dbColumn: "scramble_tds", label: "Scramble TDs", description: "Touchdowns scored on scramble plays", positions: ["QB"], dataType: "int", scope: "weekly", category: "QB Advanced" },
  { variable: "anyA", dbColumn: "any_a", label: "ANY/A", description: "Adjusted Net Yards/Attempt: (pass_yds + 20*TDs - 45*INTs - sack_yds) / (attempts + sacks)", positions: ["QB"], dataType: "float", scope: "weekly", category: "QB Advanced", forgeRelevance: "QB Context — composite passing value" },
  { variable: "fpPerDropback", dbColumn: "fp_per_dropback", label: "FP/Dropback", description: "Fantasy points per dropback — pass game fantasy efficiency", positions: ["QB"], dataType: "float", scope: "weekly", category: "QB Advanced" },

  { variable: "fptsStd", dbColumn: "fpts_std", label: "FPTS (Standard)", description: "Fantasy points in standard scoring", positions: ["QB","RB","WR","TE"], dataType: "float", scope: "both", category: "Fantasy Points" },
  { variable: "fptsHalf", dbColumn: "fpts_half", label: "FPTS (Half PPR)", description: "Fantasy points in half-PPR scoring", positions: ["QB","RB","WR","TE"], dataType: "float", scope: "both", category: "Fantasy Points" },
  { variable: "fptsPpr", dbColumn: "fpts_ppr", label: "FPTS (PPR)", description: "Fantasy points in full PPR scoring", positions: ["QB","RB","WR","TE"], dataType: "float", scope: "both", category: "Fantasy Points" },
];

const DATA_TYPE_LABELS: Record<DataType, string> = {
  int: "Integer",
  rate: "Rate (0-1)",
  pct: "Percentage",
  float: "Decimal",
  count: "Count",
};

const SCOPE_LABELS: Record<Scope, string> = {
  weekly: "Weekly",
  season: "Season",
  both: "Weekly + Season",
};

function PositionPills({ positions }: { positions: Position[] }) {
  return (
    <span className="md-pos-pills">
      {positions.map((p) => (
        <span key={p} className={`md-pos-pill md-pos-${p.toLowerCase()}`}>{p}</span>
      ))}
    </span>
  );
}

export default function MetricsDictionary() {
  useEffect(() => {
    document.title = "Metrics Dictionary - Tiber Fantasy";
  }, []);

  const [search, setSearch] = useState("");
  const [filterPos, setFilterPos] = useState<string>("all");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterScope, setFilterScope] = useState<string>("all");
  const [showForgeOnly, setShowForgeOnly] = useState(false);

  const filtered = useMemo(() => {
    return metrics.filter((m) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.variable.toLowerCase().includes(q) &&
          !m.label.toLowerCase().includes(q) &&
          !m.description.toLowerCase().includes(q) &&
          !m.dbColumn.toLowerCase().includes(q)
        ) return false;
      }
      if (filterPos !== "all" && !m.positions.includes(filterPos as Position)) return false;
      if (filterCat !== "all" && m.category !== filterCat) return false;
      if (filterScope !== "all" && m.scope !== filterScope && m.scope !== "both") return false;
      if (showForgeOnly && !m.forgeRelevance) return false;
      return true;
    });
  }, [search, filterPos, filterCat, filterScope, showForgeOnly]);

  const grouped = useMemo(() => {
    const groups: Record<string, Metric[]> = {};
    for (const m of filtered) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="md-page">
      <div className="md-header">
        <div>
          <h1 className="md-title">Metrics Dictionary</h1>
          <p className="md-subtitle">
            Every NFL data point available for FORGE scoring — {metrics.length} metrics across {CATEGORIES.length} categories
          </p>
        </div>
        <span className="md-count-badge">
          <Database size={12} />
          {filtered.length} / {metrics.length}
        </span>
      </div>

      <div className="md-controls">
        <div className="md-search-row">
          <div className="md-search-box">
            <Search size={14} />
            <input
              className="md-search-input"
              placeholder="Search by name, variable, column, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`md-forge-toggle ${showForgeOnly ? "active" : ""}`}
            onClick={() => setShowForgeOnly(!showForgeOnly)}
          >
            FORGE Variables Only
          </button>
        </div>

        <div className="md-filter-row">
          <Filter size={12} />
          <div className="md-filter-group">
            {["all", "QB", "RB", "WR", "TE"].map((p) => (
              <button
                key={p}
                className={`md-filter-btn ${filterPos === p ? "active" : ""}`}
                onClick={() => setFilterPos(p)}
              >
                {p === "all" ? "All Pos" : p}
              </button>
            ))}
          </div>
          <div className="md-filter-group">
            <select
              className="md-cat-select"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md-filter-group">
            {["all", "weekly", "season"].map((s) => (
              <button
                key={s}
                className={`md-filter-btn ${filterScope === s ? "active" : ""}`}
                onClick={() => setFilterScope(s)}
              >
                {s === "all" ? "All Scopes" : s === "weekly" ? "Weekly" : "Season"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="md-body">
        {Object.keys(grouped).length === 0 ? (
          <div className="md-empty">
            <Database size={28} />
            <p>No metrics match your filters</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="md-category">
              <div className="md-cat-header">
                <span className="md-cat-name">{cat}</span>
                <span className="md-cat-count">{items.length}</span>
              </div>
              <div className="md-table-wrap">
                <table className="md-table">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th>DB Column</th>
                      <th>Description</th>
                      <th>Positions</th>
                      <th>Type</th>
                      <th>Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.variable} className={m.forgeRelevance ? "md-forge-row" : ""}>
                        <td className="md-var-cell">
                          <code className="md-var-code">{m.variable}</code>
                          <span className="md-var-label">{m.label}</span>
                        </td>
                        <td className="md-col-cell">
                          <code className="md-db-code">{m.dbColumn}</code>
                        </td>
                        <td className="md-desc-cell">
                          {m.description}
                          {m.forgeRelevance && (
                            <span className="md-forge-tag">{m.forgeRelevance}</span>
                          )}
                        </td>
                        <td><PositionPills positions={m.positions} /></td>
                        <td className="md-type-cell">{DATA_TYPE_LABELS[m.dataType]}</td>
                        <td className="md-scope-cell">{SCOPE_LABELS[m.scope]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
