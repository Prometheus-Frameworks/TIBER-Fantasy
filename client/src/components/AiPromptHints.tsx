import { useState, useRef, useEffect } from 'react';
import { Lightbulb, Check, Copy, ChevronDown } from 'lucide-react';

// ─── TYPES ──────────────────────────────────────────────────────────────

interface PromptDef {
  label: string;
  tag: string;
  prompt: string;
}

type ModuleKey = 'wr_receiving' | 'rb_rushing' | 'qb_lab' | 'rz_redzone' | 'sit_situational';

interface AiPromptHintsProps {
  accentColor: string;
  module: ModuleKey;
}

// ─── PROMPT DEFINITIONS ─────────────────────────────────────────────────

const PROMPTS_BY_MODULE: Record<ModuleKey, PromptDef[]> = {
  wr_receiving: [
    {
      label: "Rank the top 10 most efficient receivers using a target quality model",
      tag: "Efficiency",
      prompt: `Using the attached TIBER WR receiving CSV, build a target quality model that combines aDOT, EPA/target, and YPRR to rank the top 10 most efficient receivers.

Steps:
1. Normalize each metric to a 0-1 scale (min-max across the dataset).
2. Compute a composite Target Quality Score: (normalized EPA/Target × 0.45) + (normalized YPRR × 0.35) + (normalized aDOT × 0.20)
3. Rank all WRs by this score and show the top 10.
4. For each, include: Player, Team, GP, Targets, aDOT, EPA/Target, YPRR, Target Quality Score, and Fantasy Points (PPR).
5. Note any players with fewer than 6 games played — their metrics may be inflated by small samples.

Output as a clean table with a brief 1-sentence note per player on what drives their efficiency.`,
    },
    {
      label: "Cluster WRs by route profile and find which archetype produces the highest EPA",
      tag: "Route Analysis",
      prompt: `Using the attached TIBER WR receiving CSV, cluster the wide receivers by their route depth profile and identify which archetype produces the best efficiency.

Steps:
1. Each WR has Deep Target %, Intermediate Target %, and Short Target % columns. Assign each player to one of these archetypes based on their highest percentage:
   - Deep Threat: Deep Target % is highest
   - Intermediate: Intermediate Target % is highest
   - Short/Underneath: Short Target % is highest
2. For each archetype group, compute the group averages for: EPA/Target, YPRR, Catch Rate %, YAC over Expected, Fantasy Points (PPR), and count of players.
3. Identify which archetype has the highest average EPA/Target (most efficient per target).
4. Within the top archetype, list the 5 best individual players by EPA/Target.
5. Show outliers: any player whose archetype assignment seems mismatched with their efficiency (e.g., a Deep Threat with unusually high Catch Rate, or a Short receiver with high aDOT).

Output the group comparison as a summary table, then list the top 5 in the winning archetype with brief notes.`,
    },
    {
      label: "Score breakout candidates using WOPR, YAC over Expected, and Catch Rate",
      tag: "Breakout",
      prompt: `Using the attached TIBER WR receiving CSV, create a breakout candidate score to find WRs primed for a bigger role.

Steps:
1. First, compute the dataset averages for Catch Rate % and YAC over Expected from all 150 players in the CSV.
2. Only consider WRs with 6+ games played (exclude small samples).
3. For each qualifying WR, compute:
   Breakout Score = (WOPR × 30) + ((Catch Rate % - league avg CR%) × 2) + (YAC over Expected × 20) + (TPRR × 15)
4. Rank by Breakout Score descending. Show the top 12.
5. For each, include: Player, Team, GP, Targets, WOPR, Catch Rate %, YAC over Expected, TPRR, Fantasy Points (PPR), and Breakout Score.
6. Flag players with Targets < 70 as "emerging" — low current volume but high efficiency suggests untapped upside.

Output as a table, then write 2-3 sentences on your top 3 picks explaining why their profile suggests a breakout.`,
    },
    {
      label: "Compare RACR vs YPRR to separate volume-dependent from truly efficient WRs",
      tag: "Efficiency",
      prompt: `Using the attached TIBER WR receiving CSV, compare RACR (Receiver Air Conversion Ratio) and YPRR (Yards Per Route Run) to classify receivers as volume-dependent or genuinely efficient.

Steps:
1. Only include WRs with 6+ games played to avoid small-sample distortion.
2. Compute the dataset median for both RACR and YPRR from the qualifying players.
3. Classify each WR into one of four quadrants:
   - Elite Efficient: above median in BOTH RACR and YPRR
   - Volume-Dependent: below median RACR but above median YPRR (produces yards per route but not vs air yards — needs volume)
   - Air Yards Efficient: above median RACR but below median YPRR (converts air yards well but doesn't produce per route)
   - Inefficient: below median in both
4. List all players in each quadrant, sorted by Fantasy Points (PPR) within each group.
5. Highlight the top 3 "Elite Efficient" WRs and the top 3 "Volume-Dependent" WRs with a sentence each on what their profile means for fantasy.

Output as four labeled groups with player tables, then a brief summary of what separates truly efficient receivers from volume-dependent ones in this dataset.`,
    },
  ],

  rb_rushing: [
    {
      label: "Build a rushing efficiency model using YPC, Rush EPA, and Stuff Rate",
      tag: "Efficiency",
      prompt: `Using the attached TIBER RB rushing CSV, build a rushing efficiency model that combines YPC, Rush EPA, and Stuff Rate % to rank the most efficient ball carriers.

Steps:
1. Only include RBs with 6+ games played to filter out small samples.
2. Normalize each metric to a 0-1 scale (min-max across the dataset). For Stuff Rate %, invert the normalization so lower stuff rates score higher.
3. Compute a composite Rushing Efficiency Score: (normalized Rush EPA × 0.45) + (normalized YPC × 0.30) + (normalized inverted Stuff Rate % × 0.25)
4. Rank all RBs by this score and show the top 10.
5. For each, include: Player, Team, Games Played, Rush Attempts, Rush Yards, YPC, Rush EPA, Stuff Rate %, Rush First Downs, Rushing Efficiency Score, and Fantasy Points (PPR).
6. Note any players with Rush Attempts < 100 — their metrics may be inflated by limited usage.

Output as a clean table with a brief 1-sentence note per player on what drives their efficiency.`,
    },
    {
      label: "Analyze gap distribution vs success rate to find scheme-dependent rushers",
      tag: "Scheme Fit",
      prompt: `Using the attached TIBER RB rushing CSV, analyze each RB's gap distribution and success rates to determine which runners are scheme-dependent vs truly versatile.

Steps:
1. Only include RBs with 6+ games played and 60+ Rush Attempts.
2. For each RB, examine their directional splits: Left Run %, Middle Run %, Right Run %.
3. Cross-reference with Inside Success % and Outside Success % to build a versatility profile.
4. Classify each RB into one of three archetypes:
   - Versatile: Inside Success % and Outside Success % are both above the dataset median
   - Inside Specialist: Inside Success % is above median but Outside Success % is below
   - Outside Specialist: Outside Success % is above median but Inside Success % is below
5. For each archetype, compute group averages for: YPC, Rush EPA, Rush 1st Down Rate %, Fantasy Points (PPR).
6. List the top 5 most versatile RBs by the sum of their Inside + Outside Success %.

Output as archetype group tables, then highlight the top 5 versatile backs with a note on their scheme independence.`,
    },
    {
      label: "Create a workload sustainability score using volume and receiving involvement",
      tag: "Workload",
      prompt: `Using the attached TIBER RB rushing CSV, create a workload sustainability score to identify RBs who can maintain production under heavy usage or whose receiving work protects their value.

Steps:
1. Only include RBs with 6+ games played.
2. Compute per-game rates: Rush Attempts / Games Played, Targets / Games Played, Receptions / Games Played.
3. Compute a Workload Sustainability Score:
   Sustainability = (Snap Share % × 0.25) + (Rush 1st Down Rate % × 0.25) + ((Receptions / Games Played) × 8) + ((1 - Stuff Rate % / 100) × 25) + (Catch Rate % × 0.15)
4. Rank by Sustainability Score descending. Show the top 12.
5. For each, include: Player, Team, Games Played, Snap Share %, Rush Attempts, Rush 1st Down Rate %, Stuff Rate %, Targets, Receptions, Catch Rate %, Rec Yards, Fantasy Points (PPR), and Sustainability Score.
6. Flag RBs averaging 18+ rush attempts per game as "high wear" — check if their efficiency holds up.

Output as a table, then write 2-3 sentences on your top 3 picks explaining why their workload profile is sustainable.`,
    },
    {
      label: "Flag RBs whose inside success rate diverges from outside run production",
      tag: "Splits",
      prompt: `Using the attached TIBER RB rushing CSV, identify RBs whose Inside Success % diverges significantly from Outside Success % to find game-script-dependent runners.

Steps:
1. Only include RBs with 6+ games played and 60+ Rush Attempts.
2. Compute the divergence: Inside Success % - Outside Success % for each RB.
3. Compute the dataset median divergence and standard deviation.
4. Classify each RB:
   - Inside-Dominant: divergence > +1 standard deviation (much better inside)
   - Outside-Dominant: divergence < -1 standard deviation (much better outside)
   - Balanced: within 1 standard deviation of median
5. For each group, show: Player, Team, Inside Run %, Outside Run %, Inside Success %, Outside Success %, YPC, Rush EPA, Fantasy Points (PPR).
6. Highlight the 3 most extreme Inside-Dominant and 3 most extreme Outside-Dominant RBs.

Output as three group tables, then a brief analysis on which game scripts or offensive line traits favor inside vs outside specialists.`,
    },
  ],

  qb_lab: [
    {
      label: "Build a QB process score using CPOE, EPA/play, and Success Rate",
      tag: "Process",
      prompt: `Using the attached TIBER QB Lab CSV, build a process-over-results score to separate true QB talent from box score production.

Steps:
1. Only include QBs with 6+ games played.
2. Normalize each metric to a 0-1 scale (min-max across the dataset): CPOE, EPA/Play, Success Rate %.
3. Compute a composite QB Process Score: (normalized CPOE × 0.35) + (normalized EPA/Play × 0.40) + (normalized Success Rate % × 0.25)
4. Rank all QBs by Process Score and show the top 12.
5. For each, include: Player, Team, Games Played, Dropbacks, CPOE, EPA/Play, Success Rate %, ANY/A, FP/Dropback, Fantasy Points (PPR), and Process Score.
6. Flag any QB whose Fantasy Points rank is 5+ spots higher than their Process Score rank — these may be overperforming their true talent level.

Output as a clean table with a brief 1-sentence note per QB on what drives their process grade.`,
    },
    {
      label: "Correlate shotgun and no-huddle rates with efficiency metrics",
      tag: "Play Style",
      prompt: `Using the attached TIBER QB Lab CSV, analyze how shotgun rate and no-huddle rate correlate with QB efficiency to find play-style-driven fantasy upside.

Steps:
1. Only include QBs with 6+ games played.
2. Split QBs into two groups by Shotgun %: above-median and below-median.
3. For each group, compute averages for: EPA/Play, CPOE, Success Rate %, ANY/A, FP/Dropback, Fantasy Points (PPR).
4. Repeat the same split using No Huddle % (above/below median).
5. Cross-reference: find QBs who are above median in BOTH Shotgun % and No Huddle %. Compare their average EPA/Play and Fantasy Points to the rest.
6. Compare Shotgun Success % vs Under Center Success % for each QB — flag those with a gap > 10 percentage points.

Output as comparison tables for each split, then list the top 5 QBs whose play-style profile (high shotgun + high no-huddle) best unlocks their efficiency.`,
    },
    {
      label: "Create a pressure-adjusted model using sack rate, hit rate, and scramble production",
      tag: "Pressure",
      prompt: `Using the attached TIBER QB Lab CSV, build a pressure-adjusted QB model to identify which QBs maintain or create value under duress.

Steps:
1. Only include QBs with 6+ games played.
2. Compute a Pressure Exposure Index: (Sack Rate % × 0.50) + (QB Hit Rate % × 0.50). Higher = more pressure faced.
3. Compute a Pressure Conversion Score: (Scramble Yards / Games Played × 0.40) + (Scramble TDs × 10 × 0.30) + (Rush EPA × 0.30). Higher = better at converting pressure into production.
4. Classify each QB into quadrants:
   - Pressure-Proof: above-median Pressure Exposure + above-median Pressure Conversion
   - Escape Artist: below-median Pressure Exposure + above-median Pressure Conversion
   - Vulnerable: above-median Pressure Exposure + below-median Pressure Conversion
   - Protected: below-median Pressure Exposure + below-median Pressure Conversion
5. For each, include: Player, Team, Games Played, Sack Rate %, QB Hit Rate %, Sack Yards, Scrambles, Scramble Yards, Scramble TDs, Rush EPA, Fantasy Points (PPR).

Output as four quadrant tables, then highlight the top 3 Pressure-Proof QBs with notes on their fantasy resilience.`,
    },
    {
      label: "Rank QBs by deep pass aggressiveness vs aDOT to find downfield passers",
      tag: "Deep Ball",
      prompt: `Using the attached TIBER QB Lab CSV, rank QBs by their deep passing profile to separate aggressive downfield passers from checkdown-heavy game managers.

Steps:
1. Only include QBs with 6+ games played.
2. Compute the dataset median for Deep Pass % and aDOT.
3. Classify each QB:
   - Aggressive Downfield: above median in BOTH Deep Pass % and aDOT
   - Selective Deep: above median Deep Pass % but below median aDOT (takes deep shots but overall short pass tree)
   - High aDOT / Low Deep: below median Deep Pass % but above median aDOT (pushes the ball intermediate but avoids true deep shots)
   - Conservative: below median in both
4. For each group, compute averages for: EPA/Play, CPOE, Success Rate %, Fantasy Points (PPR).
5. Within the Aggressive Downfield group, rank by EPA/Play to find QBs who are both aggressive AND efficient.
6. For each QB, include: Player, Team, Games Played, Deep Pass Attempts, Deep Pass %, aDOT, EPA/Play, CPOE, Fantasy Points (PPR).

Output as four group tables, then highlight the top 3 Aggressive Downfield QBs with a sentence each on their deep ball fantasy value.`,
    },
  ],

  rz_redzone: [
    {
      label: "Build a TD equity model using RZ snap rate, target share, and success rate",
      tag: "TD Equity",
      prompt: `Using the attached TIBER Red Zone CSV, build a TD equity model to identify which players truly own their team's scoring opportunities.

Steps:
1. Only include players with 6+ games played.
2. Normalize each metric to a 0-1 scale (min-max): RZ Snap Rate %, RZ Target Share %, RZ Success Rate %.
3. Compute a composite TD Equity Score: (normalized RZ Snap Rate % × 0.35) + (normalized RZ Target Share % × 0.40) + (normalized RZ Success Rate % × 0.25)
4. Rank all players by TD Equity Score and show the top 12.
5. For each, include: Player, Team, Position, Games Played, RZ Snaps, RZ Snap Rate %, RZ Targets, RZ Target Share %, RZ Success Rate %, Total Rec TDs, Total Rush TDs, Fantasy Points (PPR), and TD Equity Score.
6. Flag any player whose actual TDs (Rec + Rush) are significantly below their TD Equity rank — these are prime positive regression candidates.

Output as a table with a brief note per player on what drives their scoring equity.`,
    },
    {
      label: "Identify TD regression candidates by comparing RZ opportunities vs actual TDs",
      tag: "Regression",
      prompt: `Using the attached TIBER Red Zone CSV, identify players due for positive or negative TD regression by comparing red zone opportunity volume against actual TD output.

Steps:
1. Only include players with 6+ games played.
2. Compute an RZ Opportunity Index: (RZ Snaps × 0.30) + (RZ Targets × 0.40) + (RZ Rush Attempts × 0.30).
3. Compute actual TDs: Total Rec TDs + Total Rush TDs.
4. Compute the dataset average TD conversion rate: total TDs / total RZ Opportunity Index across all players.
5. For each player, compute Expected TDs = RZ Opportunity Index × league average conversion rate.
6. Compute TD Luck = Actual TDs - Expected TDs. Positive = overperformed. Negative = underperformed.
7. Show the top 8 positive regression candidates (most negative TD Luck — underperforming their opportunities) and the top 8 negative regression candidates (most positive TD Luck — overperforming).
8. For each, include: Player, Team, Position, RZ Snaps, RZ Targets, RZ Rush Attempts, Actual TDs, Expected TDs, TD Luck, Fantasy Points (PPR).

Output as two tables (positive and negative regression), then 2-3 sentences on your top buy-low and sell-high candidates.`,
    },
    {
      label: "Cross-reference RZ rush attempts with RZ receiving TDs to find goal-line roles",
      tag: "Role Analysis",
      prompt: `Using the attached TIBER Red Zone CSV, cross-reference rushing and receiving red zone usage to classify each player's goal-line role.

Steps:
1. Only include players with 6+ games played and at least 5 total RZ touches (RZ Rush Attempts + RZ Receptions).
2. Compute a RZ Receiving Share: RZ Receptions / (RZ Receptions + RZ Rush Attempts).
3. Classify each player:
   - Goal-Line Vulture: RZ Receiving Share < 0.30 (primarily rushing TDs)
   - Dual Threat: RZ Receiving Share between 0.30 and 0.70 (balanced)
   - Pass-Catching Threat: RZ Receiving Share > 0.70 (primarily receiving TDs)
4. For each archetype, compute group averages for: RZ Rush TDs, RZ Receiving TDs, RZ TD Rate %, Fantasy Points (PPR).
5. Within each group, rank by total TDs (RZ Rush TDs + RZ Receiving TDs) and show the top 5.
6. For each, include: Player, Team, Position, RZ Rush Attempts, RZ Rush TDs, RZ Receptions, RZ Receiving TDs, RZ Receiving Share, Fantasy Points (PPR).

Output as three archetype tables, then a brief note on which role type offers the most reliable fantasy scoring floor.`,
    },
    {
      label: "Create a scoring upside tier list using RZ snap rate and TD conversion",
      tag: "Upside",
      prompt: `Using the attached TIBER Red Zone CSV, create a scoring upside tier list by weighting red zone presence against TD conversion efficiency.

Steps:
1. Only include players with 6+ games played.
2. Compute the dataset median for RZ Snap Rate % and RZ TD Rate %.
3. Classify each player into scoring upside tiers:
   - Tier 1 (Elite Scorer): above median in BOTH RZ Snap Rate % and RZ TD Rate %
   - Tier 2 (Volume Scorer): above median RZ Snap Rate % but below median RZ TD Rate % (gets opportunities but doesn't convert efficiently)
   - Tier 3 (Efficient but Limited): below median RZ Snap Rate % but above median RZ TD Rate % (converts well but lacks volume)
   - Tier 4 (Low Upside): below median in both
4. For each tier, compute averages for: RZ Snaps, RZ Snap Rate %, RZ TD Rate %, Total Rec TDs + Total Rush TDs, Fantasy Points (PPR).
5. List all players in Tier 1 and Tier 2, sorted by Fantasy Points (PPR).
6. For each, include: Player, Team, Position, Games Played, RZ Snaps, RZ Snap Rate %, RZ TD Rate %, Total TDs, Fantasy Points (PPR).

Output as tier-grouped tables, then highlight the top 3 Tier 2 players as buy-low candidates (high volume, due for better conversion).`,
    },
  ],

  sit_situational: [
    {
      label: "Build a clutch performer index using 3rd down, 2-minute, and hurry-up production",
      tag: "Clutch",
      prompt: `Using the attached TIBER Situational Lab CSV, build a clutch performer index to rank players by their production in high-leverage situations.

Steps:
1. Only include players with 6+ games played.
2. Normalize each metric to a 0-1 scale (min-max): 3rd Down Conv %, 2-Min Success %, Hurry-Up Success %.
3. Compute a Clutch Index: (normalized 3rd Down Conv % × 0.40) + (normalized 2-Min Success % × 0.35) + (normalized Hurry-Up Success % × 0.25)
4. Rank all players by Clutch Index and show the top 12.
5. For each, include: Player, Team, Position, Games Played, 3rd Down Snaps, 3rd Down Conv %, 2-Min Snaps, 2-Min Success %, Hurry-Up Snaps, Hurry-Up Success %, Overall Success %, Fantasy Points (PPR), and Clutch Index.
6. Flag any player whose Clutch Index rank is 5+ spots above their overall Fantasy Points rank — these players disproportionately produce in key moments.

Output as a table with a brief note per player on what makes them clutch.`,
    },
    {
      label: "Identify game-script-proof players with above-average early and late down success",
      tag: "Consistency",
      prompt: `Using the attached TIBER Situational Lab CSV, identify game-script-proof players whose production holds up regardless of game situation.

Steps:
1. Only include players with 6+ games played.
2. Compute the dataset median for Early Down Success % and Late Down Success %.
3. Classify each player:
   - Game-Script-Proof: above median in BOTH Early Down Success % and Late Down Success %
   - Early-Down Specialist: above median Early Down but below median Late Down
   - Late-Down Specialist: below median Early Down but above median Late Down
   - Script-Dependent: below median in both
4. For each group, compute averages for: Overall Success %, 3rd Down Conv %, Fantasy Points (PPR), and player count.
5. List all Game-Script-Proof players, sorted by Fantasy Points (PPR).
6. For each, include: Player, Team, Position, Games Played, Early Down Success %, Late Down Success %, Overall Success %, 3rd Down Conv %, Fantasy Points (PPR).

Output as four group tables, then highlight the top 5 Game-Script-Proof players as the most matchup-proof fantasy options.`,
    },
    {
      label: "Create a closer score for WR/TEs using 2-minute targets and receptions",
      tag: "2-Minute",
      prompt: `Using the attached TIBER Situational Lab CSV, create a closer score to find WRs and TEs who dominate 2-minute drill usage — the players who get the ball when it matters most.

Steps:
1. Only include players with 6+ games played and Position = WR or TE.
2. Compute per-game 2-minute rates: 2-Min Targets / Games Played, 2-Min Receptions / Games Played.
3. Compute a Closer Score:
   Closer Score = (2-Min Targets / Games Played × 15) + (2-Min Receptions / Games Played × 20) + (2-Min Success % × 0.50)
4. Rank by Closer Score descending. Show the top 10.
5. For each, include: Player, Team, Position, Games Played, 2-Min Snaps, 2-Min Targets, 2-Min Receptions, 2-Min Success %, Overall Success %, Fantasy Points (PPR), and Closer Score.
6. Compare each player's 2-Min target rate to their overall target rate (if available from the Receiving Lab) — flag those with disproportionately high 2-Min usage.

Output as a table, then write 2-3 sentences on your top 3 picks explaining why their 2-minute usage signals trustworthy fantasy production.`,
    },
    {
      label: "Compare short yardage conversion rate vs overall success rate for power profiles",
      tag: "Short Yardage",
      prompt: `Using the attached TIBER Situational Lab CSV, compare short yardage conversion efficiency to overall success rate to find players with elite power profiles.

Steps:
1. Only include players with 6+ games played and 5+ Short Yardage Attempts.
2. Compute the dataset median for Short Yardage Rate % and Overall Success %.
3. Classify each player:
   - Power Elite: above median in BOTH Short Yardage Rate % and Overall Success %
   - Short Yardage Specialist: above median Short Yardage Rate % but below median Overall Success %
   - Consistent but Not Powerful: below median Short Yardage Rate % but above median Overall Success %
   - Replacement Level: below median in both
4. For each group, compute averages for: Short Yardage Attempts, Short Yardage Conversions, Short Yardage Rate %, Overall Success %, Fantasy Points (PPR).
5. List all players in each group, sorted by Fantasy Points (PPR).
6. For each, include: Player, Team, Position, Games Played, Short Yardage Attempts, Short Yardage Conversions, Short Yardage Rate %, Overall Success %, Fantasy Points (PPR).

Output as four group tables, then highlight the top 3 Power Elite players with a note on their goal-line and short-yardage fantasy value.`,
    },
  ],
};

// ─── COMPONENT ──────────────────────────────────────────────────────────

const COPY_FEEDBACK_MS = 1800;

export function AiPromptHints({ accentColor, module }: AiPromptHintsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const prompts = PROMPTS_BY_MODULE[module] || [];

  // close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setExpandedIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleCopy = async (idx: number) => {
    try {
      await navigator.clipboard.writeText(prompts[idx].prompt);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), COPY_FEEDBACK_MS);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = prompts[idx].prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), COPY_FEEDBACK_MS);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-transparent cursor-pointer transition-colors hover:bg-gray-50"
        style={{ color: accentColor }}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        AI Tips
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white border border-gray-200 rounded-xl shadow-lg z-[1000] overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-gray-100">
            <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
              Try these with your AI collaborator
            </span>
          </div>

          {/* Prompt list */}
          <div className="py-2">
            {prompts.map((p, idx) => (
              <div key={idx} className="px-5">
                {/* Label row */}
                <div
                  className="flex items-start justify-between gap-2.5 py-2.5 cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => toggleExpand(idx)}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span
                      className="text-lg leading-[1.4] flex-shrink-0"
                      style={{ color: accentColor }}
                    >
                      &bull;
                    </span>
                    <span className="text-sm leading-relaxed text-gray-800">
                      {p.label}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                    style={{
                      color: accentColor,
                      backgroundColor: `${accentColor}15`,
                    }}
                  >
                    {p.tag}
                  </span>
                </div>

                {/* Expanded prompt preview + copy */}
                {expandedIdx === idx && (
                  <div className="pl-6 pb-3 animate-in fade-in duration-150">
                    <pre className="text-xs leading-relaxed text-gray-500 font-mono bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-3 whitespace-pre-wrap break-words mb-2 max-h-40 overflow-y-auto">
                      {p.prompt.length > 280
                        ? p.prompt.slice(0, 280) + '...'
                        : p.prompt}
                    </pre>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(idx);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                        copiedIdx === idx
                          ? 'text-green-600 bg-green-50 border border-green-200'
                          : 'border hover:opacity-80'
                      }`}
                      style={
                        copiedIdx === idx
                          ? undefined
                          : {
                              color: accentColor,
                              backgroundColor: `${accentColor}10`,
                              borderColor: `${accentColor}30`,
                            }
                      }
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy full prompt
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            <span>Export CSV → paste prompt into your AI agent</span>
          </div>
        </div>
      )}
    </div>
  );
}
