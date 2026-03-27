import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const season = 2026;

const paths = {
  combineSource: path.join(repoRoot, 'data/rookies/2026_combine_results.json'),
  productionSource: path.join(repoRoot, 'data/rookies/2026_college_production.json'),
  gradesSource: path.join(repoRoot, 'data/rookies/2026_rookie_grades_v2.json'),
  combineCanonical: path.join(repoRoot, 'data/raw/2026_combine_results.json'),
  productionCanonical: path.join(repoRoot, 'data/processed/2026_college_production.json'),
  draftCapitalCanonical: path.join(repoRoot, 'data/processed/2026_draft_capital_proxy.json'),
  promotedJson: path.join(repoRoot, 'exports/promoted/rookie-alpha/2026_rookie_alpha_predraft_v0.json'),
  promotedCsv: path.join(repoRoot, 'exports/promoted/rookie-alpha/2026_rookie_alpha_predraft_v0.csv'),
  manifest: path.join(repoRoot, 'exports/promoted/rookie-alpha/2026_manifest.json'),
};

function normalizeName(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function formatPlayerId(name, pos) {
  const base = normalizeName(name).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
  return `r${season}-${pos.toLowerCase()}-${base}`;
}

function draftCapitalScore(round) {
  if (round == null || !Number.isFinite(round)) return 50;
  const table = { 1: 100, 2: 78, 3: 56, 4: 34, 5: 18, 6: 10, 7: 5 };
  return table[Math.trunc(round)] ?? 5;
}

function rookieTier(alpha) {
  if (alpha >= 80) return 'T1';
  if (alpha >= 65) return 'T2';
  if (alpha >= 50) return 'T3';
  if (alpha >= 35) return 'T4';
  return 'T5';
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

async function readWrappedPlayers(filePath) {
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (!raw || !Array.isArray(raw.players)) {
    throw new Error(`${filePath} must contain { players: [] }`);
  }
  return raw.players;
}

async function main() {
  const [combineRows, productionRows, gradeRows] = await Promise.all([
    readWrappedPlayers(paths.combineSource),
    readWrappedPlayers(paths.productionSource),
    readWrappedPlayers(paths.gradesSource),
  ]);

  const combineByKey = new Map(combineRows.map((row) => [`${normalizeName(row.name)}|${String(row.pos ?? '').toUpperCase()}`, row]));
  const productionByKey = new Map(productionRows.map((row) => [`${normalizeName(row.player_name)}|${String(row.position ?? '').toUpperCase()}`, row]));
  const gradesByKey = new Map(gradeRows.map((row) => [`${normalizeName(row.name)}|${String(row.pos ?? '').toUpperCase()}`, row]));

  const allKeys = [...new Set([...combineByKey.keys(), ...productionByKey.keys(), ...gradesByKey.keys()])].sort();

  const excluded = [];
  const merged = [];

  for (const key of allKeys) {
    const combine = combineByKey.get(key);
    const production = productionByKey.get(key);
    const grades = gradesByKey.get(key);

    if (!combine || !production || !grades) {
      excluded.push({ key, missing: { combine: !combine, production: !production, grades: !grades } });
      continue;
    }

    const playerName = combine.name;
    const position = String(combine.pos ?? '').toUpperCase();
    const playerId = formatPlayerId(playerName, position);
    const projRound = Number.isFinite(combine.proj_round) ? Math.trunc(combine.proj_round) : null;
    const draftScore = draftCapitalScore(projRound);
    const rasV2 = Number.isFinite(grades.tiber_ras_v2) ? grades.tiber_ras_v2 : null;
    const rasV1 = Number.isFinite(grades.tiber_ras) ? grades.tiber_ras : null;
    const productionScore = Number.isFinite(production.production_score) ? production.production_score : 50;
    const athleticismScore = rasV2 != null ? Math.round(rasV2 * 10) : 50;
    const rookieAlpha = Math.round(athleticismScore * 0.35 + productionScore * 0.45 + draftScore * 0.20);

    merged.push({
      player_id: playerId,
      name: playerName,
      pos: position,
      school: combine.college ?? production.school ?? null,
      proj_round: projRound,
      tiber_rookie_alpha: rookieAlpha,
      rookie_tier: rookieTier(rookieAlpha),
      tiber_ras: rasV1,
      tiber_ras_v2: rasV2,
      production_score: Number.isFinite(production.production_score) ? production.production_score : null,
      dominator_rating: Number.isFinite(production.dominator_rating) ? production.dominator_rating : null,
      college_target_share: Number.isFinite(production.college_target_share) ? production.college_target_share : null,
      college_ypc: Number.isFinite(production.college_ypc) ? production.college_ypc : null,
      draft_capital_score: draftScore,
      athleticism_score: athleticismScore,
      ht: Number.isFinite(combine.ht) ? combine.ht : null,
      wt: Number.isFinite(combine.wt) ? combine.wt : null,
      forty: Number.isFinite(combine.forty) ? combine.forty : null,
      ten: Number.isFinite(combine.ten) ? combine.ten : null,
      vert: Number.isFinite(combine.vert) ? combine.vert : null,
      broad: Number.isFinite(combine.broad) ? combine.broad : null,
      cone: Number.isFinite(combine.cone) ? combine.cone : null,
      shuttle: Number.isFinite(combine.shuttle) ? combine.shuttle : null,
      profile_summary: null,
      identity_note: null,
      board_summary: null,
    });
  }

  merged.sort((a, b) => (b.tiber_rookie_alpha ?? 0) - (a.tiber_rookie_alpha ?? 0) || a.name.localeCompare(b.name));
  merged.forEach((row, index) => {
    row.rookie_rank = index + 1;
  });

  const combineCanonical = {
    season,
    generated_at: new Date().toISOString(),
    players: merged.map((row) => ({
      player_id: row.player_id,
      player_name: row.name,
      position: row.pos,
      school: row.school,
      ht: row.ht,
      wt: row.wt,
      forty: row.forty,
      ten: row.ten,
      vert: row.vert,
      broad: row.broad,
      cone: row.cone,
      shuttle: row.shuttle,
    })),
  };

  const productionCanonical = {
    season,
    generated_at: new Date().toISOString(),
    players: merged.map((row) => ({
      player_id: row.player_id,
      player_name: row.name,
      position: row.pos,
      school: row.school,
      production_score: row.production_score,
      dominator_rating: row.dominator_rating,
      college_target_share: row.college_target_share,
      college_ypc: row.college_ypc,
    })),
  };

  const draftCapitalCanonical = {
    season,
    generated_at: new Date().toISOString(),
    players: merged.map((row) => ({
      player_id: row.player_id,
      player_name: row.name,
      position: row.pos,
      proj_round: row.proj_round,
      draft_capital_score: row.draft_capital_score,
      proxy_rule: 'R1=100,R2=78,R3=56,R4=34,R5=18,R6=10,R7=5,null=50',
    })),
  };

  const promotedArtifact = {
    meta: {
      season,
      model_name: 'Rookie Alpha',
      model_version: 'predraft_v0',
      generated_at: new Date().toISOString(),
      promoted_at: new Date().toISOString(),
      player_count: merged.length,
      exclusions: excluded,
    },
    players: merged,
  };

  const csvColumns = [
    'rookie_rank','player_id','name','pos','school','proj_round','tiber_rookie_alpha','rookie_tier','tiber_ras','tiber_ras_v2','production_score','dominator_rating','college_target_share','college_ypc','draft_capital_score','athleticism_score','ht','wt','forty','ten','vert','broad','cone','shuttle'
  ];
  const csvLines = [
    csvColumns.join(','),
    ...merged.map((row) => csvColumns.map((col) => csvEscape(row[col])).join(',')),
  ];

  const manifest = {
    season,
    generated_at: new Date().toISOString(),
    source_datasets: {
      combine_input_rows: combineRows.length,
      production_input_rows: productionRows.length,
      grades_input_rows: gradeRows.length,
    },
    join_integrity: {
      joined_rows: merged.length,
      excluded_rows: excluded.length,
      excluded,
    },
    outputs: {
      promoted_json: path.relative(repoRoot, paths.promotedJson),
      promoted_csv: path.relative(repoRoot, paths.promotedCsv),
      canonical_combine: path.relative(repoRoot, paths.combineCanonical),
      canonical_production: path.relative(repoRoot, paths.productionCanonical),
      canonical_draft_capital: path.relative(repoRoot, paths.draftCapitalCanonical),
    },
  };

  await Promise.all([
    fs.mkdir(path.dirname(paths.combineCanonical), { recursive: true }),
    fs.mkdir(path.dirname(paths.productionCanonical), { recursive: true }),
    fs.mkdir(path.dirname(paths.promotedJson), { recursive: true }),
  ]);

  await Promise.all([
    fs.writeFile(paths.combineCanonical, `${JSON.stringify(combineCanonical, null, 2)}\n`),
    fs.writeFile(paths.productionCanonical, `${JSON.stringify(productionCanonical, null, 2)}\n`),
    fs.writeFile(paths.draftCapitalCanonical, `${JSON.stringify(draftCapitalCanonical, null, 2)}\n`),
    fs.writeFile(paths.promotedJson, `${JSON.stringify(promotedArtifact, null, 2)}\n`),
    fs.writeFile(paths.promotedCsv, `${csvLines.join('\n')}\n`),
    fs.writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);

  console.log(`Built ${merged.length} promoted rookie rows for ${season}.`);
  if (excluded.length > 0) {
    console.log(`Excluded ${excluded.length} rows due to join misalignment.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
