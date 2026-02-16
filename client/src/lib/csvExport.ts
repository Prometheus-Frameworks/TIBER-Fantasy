export interface CsvColumn {
  key: string;
  label: string;
  format?: 'raw' | 'pct' | 'dec' | 'int';
  decimals?: number;
}

function formatValue(val: any, format?: string, decimals = 2): string {
  if (val == null || val === undefined) return '';
  if (format === 'pct') return typeof val === 'number' ? (val * 100).toFixed(1) : String(val);
  if (format === 'dec') return typeof val === 'number' ? val.toFixed(decimals) : String(val);
  if (format === 'int') return typeof val === 'number' ? String(Math.round(val)) : String(val);
  return String(val);
}

function escapeCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

const MODULE_SAMPLE_PROMPTS: Record<string, string> = {
  receiving: 'Using this 2025 WR receiving data, rank the top 10 most efficient receivers by a custom score: 0.4*EPA/Target + 0.3*(Catch Rate %/62) + 0.3*YPRR. Then cluster by route profile (deep/intermediate/short %) and highlight which archetype has the highest average ceiling (fantasy points).',
  rushing: 'Using this 2025 RB rushing data, create a composite efficiency score: 0.4*Rush EPA + 0.3*(1 - Stuff Rate %) + 0.3*Rush 1st Down Rate %. Then compare inside vs outside success rates to classify each back as a power runner, zone runner, or versatile back.',
  qb: 'Using this 2025 QB data, build a process-over-results score: 0.4*CPOE + 0.3*EPA/Play + 0.3*Success Rate %. Identify which QBs rank top 5 in process but outside top 10 in fantasy points — these are prime buy-low targets in dynasty.',
  'red-zone': 'Using this 2025 red zone data, calculate a TD Equity score: 0.5*RZ Snap Rate % + 0.3*RZ Target Share % + 0.2*RZ Success Rate %. Flag players in the top 10 by TD Equity but bottom half in actual TDs — these are your positive TD regression candidates.',
  'situational-down-distance': 'Using this 2025 situational data, create a Clutch Index: 0.4*3rd Down Conv % + 0.3*2-Min Success % + 0.3*Hurry-Up Success %. Identify game-script-proof players whose early-down and late-down success rates are both above the position average.',
  'situational-two-minute': 'Using this 2025 two-minute drill data, rank players by closer potential: weight 2-Min Targets, 2-Min Receptions, and 2-Min Success Rate to find who dominates in crunch time.',
  'situational-hurry-up': 'Using this 2025 hurry-up data, identify tempo-proof players by comparing hurry-up success rate to overall success rate — who thrives when the pace accelerates?',
};

export function buildCsvString(
  rows: Record<string, any>[],
  columns: CsvColumn[],
  meta?: { module: string; position: string; season: string; weekRange?: string; count?: number }
): string {
  const lines: string[] = [];

  if (meta) {
    lines.push(`# Tiber Fantasy Data Lab Export`);
    lines.push(`# Module: ${meta.module}`);
    lines.push(`# Position: ${meta.position} | Season: ${meta.season}${meta.weekRange ? ` | Weeks: ${meta.weekRange}` : ''}`);
    lines.push(`# Players: ${meta.count ?? rows.length} | Exported: ${new Date().toISOString()}`);
    lines.push(`# Percentage columns are expressed as whole numbers (e.g. 45.2 = 45.2%)`);
    lines.push('#');
    const samplePrompt = MODULE_SAMPLE_PROMPTS[meta.module];
    if (samplePrompt) {
      lines.push(`# Sample AI prompt (copy-paste this along with the data into your AI):`);
      lines.push(`# "${samplePrompt}"`);
    }
    lines.push('');
  }

  lines.push(columns.map(c => escapeCell(c.label)).join(','));

  for (const row of rows) {
    const cells = columns.map(c => escapeCell(formatValue(row[c.key], c.format, c.decimals)));
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}

export function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLabCsv(
  rows: Record<string, any>[],
  columns: CsvColumn[],
  meta: { module: string; position: string; season: string; weekRange?: string; count?: number }
) {
  const csv = buildCsvString(rows, columns, meta);
  const safeName = `tiber_${meta.module}_${meta.position}_${meta.season}.csv`;
  downloadCsv(csv, safeName);
}
