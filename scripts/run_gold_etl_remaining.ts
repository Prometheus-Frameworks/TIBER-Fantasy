import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';

async function main() {
  const season = 2025;
  
  for (let week = 7; week <= 18; week++) {
    try {
      const result = await runGoldETLForWeek(season, week);
      console.log(`Week ${week}: snapshot_id=${result.snapshotId}, records=${result.recordCount}`);
    } catch (e: any) {
      console.error(`Week ${week}: ERROR — ${e.message}`);
    }
  }
  
  console.log(`\nDone.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
