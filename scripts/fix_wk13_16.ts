import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';

async function main() {
  const season = 2025;
  for (const week of [13, 14, 15, 16]) {
    const result = await runGoldETLForWeek(season, week);
    console.log(`Week ${week}: snapshot_id=${result.snapshotId}, records=${result.recordCount}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
