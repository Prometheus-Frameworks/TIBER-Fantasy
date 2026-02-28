import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';

async function main() {
  const season = 2025;
  let totalRecords = 0;
  
  for (let week = 1; week <= 18; week++) {
    try {
      const result = await runGoldETLForWeek(season, week);
      console.log(`Week ${week}: snapshot_id=${result.snapshotId}, records=${result.recordCount}`);
      totalRecords += result.recordCount;
    } catch (e: any) {
      console.error(`Week ${week}: ERROR — ${e.message}`);
    }
  }
  
  console.log(`\nDone. Total records: ${totalRecords}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
