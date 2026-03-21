import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  ForgeParityReport,
  ForgeParityReportService,
  forgeParityReportService,
  formatForgeParityReportConsole,
  formatForgeParityReportJson,
} from './forgeParityReportService';

export interface ForgeParityReportExportOptions {
  format?: 'json' | 'pretty';
  outputPath?: string;
}

export function renderForgeParityReport(
  report: ForgeParityReport,
  format: ForgeParityReportExportOptions['format'] = 'pretty',
): string {
  return format === 'json' ? formatForgeParityReportJson(report) : formatForgeParityReportConsole(report);
}

export async function exportForgeParityReport(
  options: ForgeParityReportExportOptions = {},
  service: Pick<ForgeParityReportService, 'generateReport'> = forgeParityReportService,
): Promise<ForgeParityReport> {
  const report = await service.generateReport();

  if (options.outputPath) {
    const absolutePath = path.resolve(options.outputPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, formatForgeParityReportJson(report) + '\n', 'utf8');
  }

  return report;
}
