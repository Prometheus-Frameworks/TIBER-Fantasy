import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../server/infra/db";
import { rookieProfiles } from "../shared/schema";

type JsonObject = Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const combinePath = path.join(repoRoot, "data/rookies/2026_combine_results.json");
const gradesPath = path.join(repoRoot, "data/rookies/2026_rookie_grades.json");

function getString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getInteger(value: unknown): number | null {
  const num = getNumber(value);
  return num == null ? null : Math.trunc(num);
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(getString).filter((item): item is string => item != null);
}

function normalizedName(record: JsonObject): string {
  const name =
    getString(record.player_name) ??
    getString(record.playerName) ??
    getString(record.name) ??
    "";
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

async function loadArray(filePath: string): Promise<JsonObject[]> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain a top-level array`);
  }
  return parsed.filter((r): r is JsonObject => !!r && typeof r === "object");
}

async function main() {
  const combineRows = await loadArray(combinePath);
  const gradeRows = await loadArray(gradesPath);

  const combineByName = new Map<string, JsonObject>();
  for (const row of combineRows) {
    const key = normalizedName(row);
    if (key) combineByName.set(key, row);
  }

  const gradeByName = new Map<string, JsonObject>();
  for (const row of gradeRows) {
    const key = normalizedName(row);
    if (key) gradeByName.set(key, row);
  }

  const allNames = new Set<string>([...combineByName.keys(), ...gradeByName.keys()]);

  const mergedRows = [...allNames].map((nameKey) => {
    const combine = combineByName.get(nameKey) ?? {};
    const grade = gradeByName.get(nameKey) ?? {};
    const playerName =
      getString(grade.player_name) ??
      getString(grade.playerName) ??
      getString(grade.name) ??
      getString(combine.player_name) ??
      getString(combine.playerName) ??
      getString(combine.name);

    if (!playerName) {
      throw new Error(`Missing player name for merged key: ${nameKey}`);
    }

    return {
      playerName,
      position:
        getString(grade.position) ??
        getString(combine.position),
      school:
        getString(grade.school) ??
        getString(combine.school) ??
        getString(grade.college) ??
        getString(combine.college),
      classYear: getInteger(grade.class_year) ?? getInteger(grade.classYear),
      overallGrade: getNumber(grade.overall_grade) ?? getNumber(grade.overallGrade) ?? getNumber(grade.grade),
      tier: getString(grade.tier),
      strengths: getStringArray(grade.strengths),
      concerns: getStringArray(grade.concerns),
      playerComp: getString(grade.player_comp) ?? getString(grade.playerComp),
      notes: getString(grade.notes),
      heightInches: getNumber(combine.height_inches) ?? getNumber(combine.heightInches),
      weightLbs: getNumber(combine.weight_lbs) ?? getNumber(combine.weightLbs),
      handSize: getNumber(combine.hand_size) ?? getNumber(combine.handSize),
      armLength: getNumber(combine.arm_length) ?? getNumber(combine.armLength),
      fortyYardDash: getNumber(combine.forty_yard_dash) ?? getNumber(combine.fortyYardDash),
      tenYardSplit: getNumber(combine.ten_yard_split) ?? getNumber(combine.tenYardSplit),
      verticalJump: getNumber(combine.vertical_jump) ?? getNumber(combine.verticalJump),
      broadJump: getNumber(combine.broad_jump) ?? getNumber(combine.broadJump),
      shortShuttle: getNumber(combine.short_shuttle) ?? getNumber(combine.shortShuttle),
      threeCone: getNumber(combine.three_cone) ?? getNumber(combine.threeCone),
      benchPress: getInteger(combine.bench_press) ?? getInteger(combine.benchPress),
      combineRaw: combine,
      gradeRaw: grade,
    };
  });

  if (mergedRows.length !== 91) {
    throw new Error(`Expected 91 merged rookie rows, got ${mergedRows.length}`);
  }

  await db.delete(rookieProfiles);
  await db.insert(rookieProfiles).values(mergedRows);

  console.log(`✅ Seeded rookie_profiles with ${mergedRows.length} rows.`);
}

main().catch((error) => {
  console.error("❌ Failed to seed rookie profiles:", error);
  process.exit(1);
});
