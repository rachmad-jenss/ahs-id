import type { AhspGroup, HSPResult } from '@ahs-id/core';
import type { PortalHspResult } from '@/lib/portal-hsp';
import { uraianKomponen } from '@/components/hsp-rab-table';

const HEADER = ['Uraian', 'Satuan', 'Koefisien', 'Harga Satuan', 'Jumlah'] as const;

function escapeCell(value: string): string {
  if (/[\t\n\r"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowLine(cells: readonly string[]): string {
  return cells.map(escapeCell).join('\t');
}

function pushGroupTsv(
  lines: string[],
  sectionLabel: string,
  rows: readonly {
    uraian: string;
    satuan: string;
    koef: number | null;
    harga: number | null;
    jumlah: number | null;
  }[],
  mode: 'values' | 'formulas',
  rowCounter: { n: number },
): number[] {
  lines.push(rowLine([sectionLabel, '', '', '', '']));
  rowCounter.n += 1;
  lines.push(rowLine([...HEADER]));
  rowCounter.n += 1;
  const subtotalRows: number[] = [];
  const firstDataRow = rowCounter.n + 1;
  for (const r of rows) {
    rowCounter.n += 1;
    const excelRow = rowCounter.n;
    const jumlah =
      mode === 'formulas' && r.koef != null && r.harga != null
        ? `=C${excelRow}*D${excelRow}`
        : r.jumlah != null
          ? String(r.jumlah)
          : '';
    lines.push(
      rowLine([
        r.uraian,
        r.satuan,
        r.koef != null ? String(r.koef) : '',
        r.harga != null ? String(r.harga) : '',
        jumlah,
      ]),
    );
  }
  rowCounter.n += 1;
  const subtotalRow = rowCounter.n;
  const lastDataRow = rows.length > 0 ? subtotalRow - 1 : subtotalRow;
  const subtotalFormula =
    mode === 'formulas' && rows.length > 0
      ? `=SUM(E${firstDataRow}:E${lastDataRow})`
      : String(rows.reduce((s, r) => s + (r.jumlah ?? 0), 0));
  lines.push(rowLine([`Subtotal ${sectionLabel}`, '', '', 'Subtotal', subtotalFormula]));
  subtotalRows.push(subtotalRow);
  rowCounter.n += 1;
  lines.push('');
  rowCounter.n += 1;
  return subtotalRows;
}

/** TSV RAB dari hasil engine (cocok ditempel ke Excel). */
export function hspResultToTsv(result: HSPResult, mode: 'values' | 'formulas'): string {
  const lines: string[] = [];
  const rowCounter = { n: 0 };
  lines.push(rowLine([`${result.kode_ahsp} — ${result.nama}`, '', '', '', '']));
  rowCounter.n += 1;
  lines.push(rowLine([`Satuan pekerjaan: ${result.satuan_bayar}`, '', '', '', '']));
  rowCounter.n += 1;
  lines.push('');
  rowCounter.n += 1;

  const sectionLabel: Record<AhspGroup['type'], string> = {
    L: 'A. Tenaga Kerja',
    M: 'B. Bahan',
    E: 'C. Peralatan',
  };

  const subtotalRows: number[] = [];
  for (const group of result.groups) {
    const label = sectionLabel[group.type] ?? group.title;
    const rows = group.components.map((c) => ({
      uraian: uraianKomponen(c.ref, c.nama),
      satuan: c.satuan,
      koef: c.coefficient,
      harga: c.unit_price,
      jumlah: c.total_price,
    }));
    subtotalRows.push(...pushGroupTsv(lines, label, rows, mode, rowCounter));
  }

  if (result.subAhsp.length > 0) {
    const rows = result.subAhsp.map((line) => ({
      uraian: uraianKomponen(line.ref_ahsp, line.nama),
      satuan: '—',
      koef: line.koefisien,
      harga: line.unit_price,
      jumlah: line.total_price,
    }));
    subtotalRows.push(...pushGroupTsv(lines, 'D. Sub AHSP', rows, mode, rowCounter));
  }

  const overheadValue = result.baseTotal * (result.overheadPct / 100);
  const profitValue = result.baseTotal * (result.profitPct / 100);
  const directLabel =
    result.subAhsp.length > 0 ? 'Biaya Langsung (A+B+C+D)' : 'Biaya Langsung (A+B+C)';

  lines.push(rowLine(['Rekapitulasi', '', '', '', '']));
  rowCounter.n += 1;
  rowCounter.n += 1;
  const directRow = rowCounter.n;
  const directAmount =
    mode === 'formulas' && subtotalRows.length > 0
      ? `=${subtotalRows.map((r) => `E${r}`).join('+')}`
      : String(result.baseTotal);
  lines.push(rowLine([directLabel, '', '', '', directAmount]));

  rowCounter.n += 1;
  const overheadRow = rowCounter.n;
  const overheadCell =
    mode === 'formulas'
      ? `=E${directRow}*${result.overheadPct}/100`
      : String(overheadValue);
  lines.push(rowLine([`Overhead (${result.overheadPct}%)`, '', '', '', overheadCell]));

  rowCounter.n += 1;
  const profitRow = rowCounter.n;
  const profitCell =
    mode === 'formulas' ? `=E${directRow}*${result.profitPct}/100` : String(profitValue);
  lines.push(rowLine([`Profit (${result.profitPct}%)`, '', '', '', profitCell]));

  rowCounter.n += 1;
  const grandCell =
    mode === 'formulas'
      ? `=E${directRow}+E${overheadRow}+E${profitRow}`
      : String(result.grandTotal);
  lines.push(rowLine(['Harga Satuan Pekerjaan', '', '', '', grandCell]));

  return lines.join('\n');
}

/** TSV RAB dari hasil portal DCKTRP. */
export function portalResultToTsv(result: PortalHspResult, mode: 'values' | 'formulas'): string {
  const lines: string[] = [];
  const rowCounter = { n: 0 };
  lines.push(rowLine([`${result.kode} — ${result.nama}`, '', '', '', '']));
  rowCounter.n += 1;
  lines.push(rowLine([`Satuan pekerjaan: ${result.satuan_bayar ?? '—'}`, '', '', '', '']));
  rowCounter.n += 1;
  lines.push('');
  rowCounter.n += 1;

  const groups = [
    { label: 'A. Tenaga Kerja', rows: result.tenaga_kerja },
    { label: 'B. Bahan', rows: result.bahan },
    { label: 'C. Peralatan', rows: result.peralatan },
  ].filter((g) => g.rows.length > 0);

  const subtotalRows: number[] = [];
  for (const group of groups) {
    const rows = group.rows.map((r) => ({
      uraian: r.nama,
      satuan: r.satuan ?? '—',
      koef: r.koefisien,
      harga: r.harga_satuan_rp,
      jumlah: r.jumlah_rp,
    }));
    subtotalRows.push(...pushGroupTsv(lines, group.label, rows, mode, rowCounter));
  }

  const baseTotal = groups.reduce(
    (sum, g) => sum + g.rows.reduce((s, r) => s + (r.jumlah_rp ?? 0), 0),
    0,
  );
  const grand = result.harga_satuan_rp ?? baseTotal;

  lines.push(rowLine(['Rekapitulasi', '', '', '', '']));
  rowCounter.n += 1;
  rowCounter.n += 1;
  const directRow = rowCounter.n;
  const directAmount =
    mode === 'formulas' && subtotalRows.length > 0
      ? `=${subtotalRows.map((r) => `E${r}`).join('+')}`
      : String(baseTotal);
  lines.push(rowLine(['Biaya Langsung (A+B+C)', '', '', '', directAmount]));

  if (result.profit_rp != null) {
    rowCounter.n += 1;
    const profitRow = rowCounter.n;
    const profitCell =
      mode === 'formulas' && result.profit_pct != null
        ? `=E${directRow}*${result.profit_pct}/100`
        : String(result.profit_rp);
    lines.push(
      rowLine([
        `Profit${result.profit_pct != null ? ` (${result.profit_pct}%)` : ''}`,
        '',
        '',
        '',
        profitCell,
      ]),
    );
    rowCounter.n += 1;
    const grandCell =
      mode === 'formulas' ? `=E${directRow}+E${profitRow}` : String(grand);
    lines.push(rowLine(['Harga Satuan Pekerjaan', '', '', '', grandCell]));
  } else {
    rowCounter.n += 1;
    const grandCell = mode === 'formulas' && subtotalRows.length > 0 ? `=E${directRow}` : String(grand);
    lines.push(rowLine(['Harga Satuan Pekerjaan', '', '', '', grandCell]));
  }

  return lines.join('\n');
}
