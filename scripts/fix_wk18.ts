import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';
async function main() {
  const r = await runGoldETLForWeek(2025, 18);
  console.log(`Week 18: snapshot_id=${r.snapshotId}, records=${r.recordCount}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
