import { promises as fs } from 'fs';
import path from 'path';
import { PlayerOwnershipClient } from '../modules/externalModels/playerOwnership/playerOwnershipClient';
import { PlayerOwnershipService } from '../modules/externalModels/playerOwnership/playerOwnershipService';
import { runDynastyRosterSmokeTest, formatSmokeReportMarkdown } from '../modules/externalModels/playerOwnership/dynastyRosterSmokeHelper';
import { DYNASTY_ROSTER_SMOKE_2026 } from '../modules/externalModels/playerOwnership/__tests__/fixtures/dynastyRosterSmoke2026';

const REPORT_PATH = path.join(process.cwd(), 'docs', 'reports', 'dynasty-roster-ownership-smoke-test-2026-05-24.md');

async function main(): Promise<void> {
  console.log('[SmokeTest] Dynasty roster ownership smoke test — 2026-05-24');
  console.log(`[SmokeTest] Roster: ${DYNASTY_ROSTER_SMOKE_2026.length} players`);

  const client = new PlayerOwnershipClient();
  const service = new PlayerOwnershipService(client);
  const config = service.getStatus();

  console.log(`[SmokeTest] Artifact path: ${(config as Record<string, unknown>).latestArtifactPath}`);
  console.log(`[SmokeTest] Artifact enabled: ${config.enabled}`);

  const report = await runDynastyRosterSmokeTest(DYNASTY_ROSTER_SMOKE_2026, service);

  console.log('');
  console.log('[SmokeTest] === RESULTS ===');
  console.log(`  Artifact available : ${report.artifactAvailable}`);
  console.log(`  Total tested       : ${report.totalTested}`);
  console.log(`  Matched            : ${report.totalMatched}`);
  console.log(`  Unmatched          : ${report.totalUnmatched}`);
  console.log(`  Ambiguous          : ${report.totalAmbiguous}`);
  console.log(`  Unavailable        : ${report.totalUnavailable}`);

  if (Object.keys(report.byConfidence).length > 0) {
    console.log('  Confidence breakdown:');
    for (const [conf, count] of Object.entries(report.byConfidence)) {
      console.log(`    ${conf}: ${count}`);
    }
  }

  console.log('');

  for (const p of report.players) {
    const tag = !p.available ? '[unavailable]' : p.matched ? `[matched:${p.confidence}]` : p.ambiguous ? '[ambiguous]' : '[unmatched]';
    console.log(`  ${tag.padEnd(25)} ${p.inputName}${p.warnings.length > 0 ? ' ⚠' : ''}`);
    if (p.warnings.length > 0) {
      for (const w of p.warnings) {
        console.log(`    → ${w}`);
      }
    }
  }

  const markdown = formatSmokeReportMarkdown(report);

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, markdown, 'utf8');

  console.log('');
  console.log(`[SmokeTest] Report written to: ${REPORT_PATH}`);

  if (!report.artifactAvailable) {
    console.log('[SmokeTest] ⚠ Artifact unavailable — report documents this explicitly. No ownership truth was fabricated.');
    process.exit(0);
  }

  const allMatched = report.totalMatched === report.totalTested && report.totalUnmatched === 0 && report.totalAmbiguous === 0;
  if (allMatched) {
    console.log('[SmokeTest] ✓ All players matched.');
    process.exit(0);
  } else {
    console.log(`[SmokeTest] ✗ Coverage incomplete: ${report.totalUnmatched} unmatched, ${report.totalAmbiguous} ambiguous.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[SmokeTest] Fatal error:', err);
  process.exit(1);
});
