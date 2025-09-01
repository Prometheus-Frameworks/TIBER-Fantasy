import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Pos = "QB"|"RB"|"WR"|"TE";

export type InjuryProfile = {
  injury_type: string;
  severity_class: "minor"|"moderate"|"major"|"catastrophic";
  avg_recovery_weeks: number;
  return_to_play_timeline: { "6_months": number; "12_months": number; "24_months": number; };
  base_impact_multipliers: {
    year_of_injury: Record<Pos, number>;     // e.g. RB: 0.70
    year_after_return: Record<Pos, number>;  // e.g. WR: 0.90
  };
  age_penalty_factors: {
    threshold_ages: Record<Pos, number>;               // e.g. RB: 26
    annual_decay_over_threshold: Record<Pos, number>;  // multiplicative, e.g. RB: 0.94
  };
  recurrence_risk_12m: number; // 0..1
  position_specific_notes?: Partial<Record<Pos, string>>;
};

export type InjuryProfilesDoc = {
  injury_profiles: InjuryProfile[];
  calculation_logic?: unknown;
  severity_classes?: unknown;
  position_vulnerability_matrix?: unknown;
  data_sources?: unknown;
};

export function loadInjuryProfilesV2(path?: string) {
  // Try multiple path options to support both development and production/bundled environments
  const possiblePaths = [
    path, // Use provided path if given
    join(__dirname, "injuryProfiles.v2.json"), // Same directory as current file (bundled)
    join(__dirname, "consensus", "injuryProfiles.v2.json"), // Preserve directory structure
    join(process.cwd(), "server", "consensus", "injuryProfiles.v2.json"), // Development environment
    join(process.cwd(), "dist", "injuryProfiles.v2.json"), // Production environment
    join(process.cwd(), "injuryProfiles.v2.json") // Fallback to root
  ].filter(Boolean); // Remove undefined values

  let raw: string;
  let usedPath: string | undefined;
  
  for (const tryPath of possiblePaths) {
    try {
      if (fs.existsSync(tryPath as string)) {
        raw = fs.readFileSync(tryPath as string, "utf8");
        usedPath = tryPath;
        break;
      }
    } catch (error) {
      // Continue to next path
      continue;
    }
  }
  
  if (!raw! || !usedPath) {
    throw new Error(`injuryProfiles.v2.json not found in any of the expected locations: ${possiblePaths.join(', ')}`);
  }
  
  const doc = JSON.parse(raw) as InjuryProfilesDoc;
  if (!Array.isArray(doc.injury_profiles)) throw new Error("injury_profiles missing/invalid");
  const map = new Map<string, InjuryProfile>();
  for (const p of doc.injury_profiles) {
    map.set(p.injury_type.toLowerCase(), p);
  }
  return map;
}

export const INJ_V2 = loadInjuryProfilesV2();

/**
 * Compute dynasty multiplier k in [~0.5..1.05]
 * context:
 *   - phase: "year_of_injury" | "year_after_return"
 *   - age: player age
 *   - pos: QB/RB/WR/TE
 *   - weeksRecovered: weeks since injury rehab (optional; used to interpolate partial season)
 */
export function computeDynastyMultiplierV2(opts: {
  injuryType: string; pos: Pos; age: number;
  phase: "year_of_injury" | "year_after_return";
  weeksRecovered?: number;   // used only if phase === "year_of_injury"
}) {
  const { injuryType, pos, age, phase, weeksRecovered } = opts;
  const prof = INJ_V2.get(injuryType.toLowerCase());
  if (!prof) return 1.0;

  // 1) Base impact (phase-aware)
  const baseTable = prof.base_impact_multipliers[phase];
  let base = baseTable[pos] ?? 1.0;

  // Partial season interpolation (if returning mid-year)
  if (phase === "year_of_injury" && typeof weeksRecovered === "number" && prof.avg_recovery_weeks > 0) {
    const t = Math.max(0, Math.min(1, weeksRecovered / prof.avg_recovery_weeks));
    // Linear blend from year_of_injury → year_after_return as recovery progresses
    const y1 = prof.base_impact_multipliers.year_after_return[pos] ?? base;
    base = base * (1 - t) + y1 * t;
  }

  // 2) Age factor (exponential decay past threshold)
  const threshold = prof.age_penalty_factors.threshold_ages[pos];
  const decay = prof.age_penalty_factors.annual_decay_over_threshold[pos]; // e.g. 0.94 for RB
  const yearsOver = Math.max(0, Math.floor(age - threshold));
  const ageK = Math.pow(decay, yearsOver); // ≤ 1.0

  // 3) Recurrence adjustment (small haircut)
  const recAdj = 1.0 - (prof.recurrence_risk_12m * 0.1); // 10% of risk applied

  // Clamp a bit so nothing goes crazy
  const k = Math.max(0.5, Math.min(1.05, Number((base * ageK * recAdj).toFixed(4))));
  return k;
}