import { forgeParityHarness, formatForgeParitySnapshot } from './forgeParityHarness';

async function main() {
  const summary = await forgeParityHarness.run();
  console.info('[FORGE parity harness] completed');
  console.info(formatForgeParitySnapshot(summary));

  if (summary.driftCount > 0 || summary.unavailableCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[FORGE parity harness] failed', error);
  process.exitCode = 1;
});
