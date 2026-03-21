import { exportForgeParityReport, renderForgeParityReport } from './forgeParityReportExporter';

function parseArgs(argv: string[]) {
  let format: 'json' | 'pretty' = 'pretty';
  let outputPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--json') {
      format = 'json';
      continue;
    }

    if (arg === '--pretty') {
      format = 'pretty';
      continue;
    }

    if ((arg === '--output' || arg === '--out') && argv[index + 1]) {
      outputPath = argv[index + 1];
      index += 1;
    }
  }

  return { format, outputPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await exportForgeParityReport(options);

  console.info(renderForgeParityReport(report, options.format));

  if (options.outputPath) {
    console.info(`[FORGE parity report] wrote JSON to ${options.outputPath}`);
  }

  if (report.summary.driftCount > 0 || report.summary.unavailableCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[FORGE parity report] failed', error);
  process.exitCode = 1;
});
