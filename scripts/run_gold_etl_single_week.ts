import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';

const week = parseInt(process.argv[2]);
const season = parseInt(process.argv[3] || '2025');

if (!week || week < 1 || week > 18) {
  console.error('Usage: npx tsx scripts/run_gold_etl_single_week.ts <week> [season]');
  process.exit(1);
}

async function main() {
  const result = await runGoldETLForWeek(season, week);
  console.log(`Done: season=${season} week=${week} snapshot_id=${result.snapshotId} records=${result.recordCount}`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
