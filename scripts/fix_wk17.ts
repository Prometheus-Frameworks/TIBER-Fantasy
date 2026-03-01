import { runGoldETLForWeek } from '../server/etl/goldDatadiveETL';
async function main() {
  const r = await runGoldETLForWeek(2025, 17);
  console.log(`Week 17: snapshot_id=${r.snapshotId}, records=${r.recordCount}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
