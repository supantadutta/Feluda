/**
 * Data & Charts (Layer VI). Analyses a CSV dataset and visualises a finding.
 * Runs in-process with no arbitrary code execution (safe by construction, in
 * keeping with the boundaries) and emits a dependency-free SVG chart.
 */
export interface ColumnStats {
  column: string;
  count: number;
  min: number;
  max: number;
  mean: number;
}

export interface DataAnalysis {
  rowCount: number;
  columns: string[];
  numericStats: ColumnStats[];
  /** Inline SVG bar chart of the first numeric column. */
  chartSvg: string;
}

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.length > 0);
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()));
  return { headers, rows };
}

function barChart(label: string, values: number[]): string {
  const w = 320;
  const h = 120;
  const max = Math.max(1, ...values);
  const bw = values.length ? w / values.length : w;
  const bars = values
    .map((v, i) => {
      const bh = (v / max) * (h - 20);
      return `<rect x="${(i * bw + 2).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${bh.toFixed(1)}" fill="#0ea5e9"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${label}">${bars}</svg>`;
}

export class DataAnalyzer {
  analyzeCsv(csv: string): DataAnalysis {
    const { headers, rows } = parseCsv(csv);
    const numericStats: ColumnStats[] = [];

    headers.forEach((column, col) => {
      const nums = rows.map((r) => Number(r[col])).filter((n) => Number.isFinite(n));
      if (nums.length === rows.length && nums.length > 0) {
        numericStats.push({
          column,
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          mean: nums.reduce((s, n) => s + n, 0) / nums.length,
        });
      }
    });

    const first = numericStats[0];
    const chartSvg = first
      ? barChart(
          first.column,
          rows.map((r) => Number(r[headers.indexOf(first.column)])).filter(Number.isFinite),
        )
      : barChart('no numeric data', []);

    return { rowCount: rows.length, columns: headers, numericStats, chartSvg };
  }
}
