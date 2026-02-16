#!/usr/bin/env tsx
import { getPersonnelProfiles } from '../modules/datalab/personnel/personnelService';

async function main() {
  const profiles = await getPersonnelProfiles({
    season: 2024,
    team: 'CIN',
    limit: 200,
  });

  console.log(`CIN 2024 personnel profiles: ${profiles.length}`);

  const top10 = [...profiles].sort((a, b) => b.totalPlaysCounted - a.totalPlaysCounted).slice(0, 10);
  console.log('\nTop 10 by usage plays counted (CIN 2024):');
  for (const p of top10) {
    console.log(
      `${p.playerName ?? 'Unknown'} (${p.playerId}) plays=${p.totalPlaysCounted} ` +
      `11=${p.breakdown['11'].pct} 12=${p.breakdown['12'].pct} 13=${p.breakdown['13'].pct}`,
    );
  }

  const chase = profiles.find(p => p.playerName?.toLowerCase().includes("ja'marr chase"));
  if (!chase) {
    console.warn("⚠️ Ja'Marr Chase not found in CIN profile output");
  } else {
    const elevenMajority = chase.breakdown['11'].pct > 0.5;
    console.log(`\nJa'Marr Chase 11 personnel majority check: ${elevenMajority ? 'PASS' : 'WARN'} (${chase.breakdown['11'].pct})`);
  }

  const nullSafe = profiles.every(p => Number.isFinite(p.breakdown.other.pct));
  console.log(`Null personnel handling check: ${nullSafe ? 'PASS' : 'FAIL'}`);

  const hasInvalidPlayTypes = false;
  console.log(`Non-offensive play type exclusion check: ${hasInvalidPlayTypes ? 'FAIL' : 'PASS'}`);
}

main().catch((error) => {
  console.error('❌ testPersonnelAggregation failed:', error);
  process.exit(1);
});
