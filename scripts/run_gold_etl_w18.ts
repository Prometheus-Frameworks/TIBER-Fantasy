import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';

async function main() {
  const result = await runGoldETLForWeek(2025, 18);
  console.log(`Week 18: snapshot_id=${result.snapshotId}, records=${result.recordCount}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
