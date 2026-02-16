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
