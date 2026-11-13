import { Buffer } from 'node:buffer';
import ExcelJS from 'exceljs';
import type { AhspComponent, AhspGroup, HSPResult } from '../types/index.js';

const GROUP_SECTION_LABEL: Readonly<Record<AhspGroup['type'], string>> = {
  L: 'A. Tenaga Kerja',
  M: 'B. Bahan',
  E: 'C. Peralatan',
};

const HEADER_COLUMNS = ['Uraian', 'Satuan', 'Koefisien', 'Harga Satuan', 'Jumlah'] as const;

const COEF_FMT = '0.00000';
const IDR_FMT = '#,##0';

function splitMargin(result: HSPResult): { overheadValue: number; profitValue: number } {
  const overheadValue = result.baseTotal * (result.overheadPct / 100);
  const profitValue = result.baseTotal * (result.profitPct / 100);
  return { overheadValue, profitValue };
}

function writeHeaderRow(sheet: ExcelJS.Worksheet, row: number): void {
  const header = sheet.getRow(row);
  HEADER_COLUMNS.forEach((title, index) => {
    const cell = header.getCell(index + 1);
    cell.value = title;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
  });
}

function writeComponentRow(sheet: ExcelJS.Worksheet, row: number, component: AhspComponent): void {
  const data = sheet.getRow(row);
  data.getCell(1).value = `${component.ref} — ${component.nama}`;
  data.getCell(2).value = component.satuan;
  data.getCell(3).value = component.coefficient;
  data.getCell(3).numFmt = COEF_FMT;
  data.getCell(4).value = component.unit_price;
  data.getCell(4).numFmt = IDR_FMT;
  data.getCell(5).value = {
    formula: `C${row}*D${row}`,
    result: component.total_price,
  };
  data.getCell(5).numFmt = IDR_FMT;
}

function writeSubtotalRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  sectionLabel: string,
  firstSumRow: number,
  lastSumRow: number,
  total: number,
): number {
  const data = sheet.getRow(row);
  data.getCell(1).value = `Subtotal ${sectionLabel}`;
  data.getCell(1).font = { bold: true };
  data.getCell(4).value = 'Subtotal';
  data.getCell(4).font = { bold: true };
  data.getCell(4).alignment = { horizontal: 'right' };
  data.getCell(5).value = {
    formula: `SUM(E${firstSumRow}:E${lastSumRow})`,
    result: total,
  };
  data.getCell(5).numFmt = IDR_FMT;
  data.getCell(5).font = { bold: true };
  return row;
}

function writeSummaryRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  amount: number | { formula: string; result: number },
  options?: { bold?: boolean },
): number {
  const data = sheet.getRow(row);
  data.getCell(1).value = label;
  if (options?.bold) {
    data.getCell(1).font = { bold: true };
  }
  if (typeof amount === 'number') {
    data.getCell(5).value = amount;
  } else {
    data.getCell(5).value = amount;
  }
  data.getCell(5).numFmt = IDR_FMT;
  if (options?.bold) {
    data.getCell(5).font = { bold: true };
  }
  return row;
}

function writeSubAhspSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  result: HSPResult,
): { nextRow: number; subtotalRow: number } {
  let row = startRow;
  const title = sheet.getRow(row);
  title.getCell(1).value = 'D. Sub AHSP';
  title.getCell(1).font = { bold: true };
  row += 1;
  writeHeaderRow(sheet, row);
  row += 1;
  const firstSumRow = row;
  let total = 0;
  for (const line of result.subAhsp) {
    const data = sheet.getRow(row);
    data.getCell(1).value = `${line.ref_ahsp} — ${line.nama}`;
    data.getCell(3).value = line.koefisien;
    data.getCell(3).numFmt = COEF_FMT;
    data.getCell(4).value = line.unit_price;
    data.getCell(4).numFmt = IDR_FMT;
    data.getCell(5).value = {
      formula: `C${row}*D${row}`,
      result: line.total_price,
    };
    data.getCell(5).numFmt = IDR_FMT;
    total += line.total_price;
    row += 1;
  }
  const lastSumRow = result.subAhsp.length > 0 ? row - 1 : row;
  const subtotalRow = writeSubtotalRow(
    sheet,
    row,
    'D. Sub AHSP',
    firstSumRow,
    lastSumRow,
    total,
  );
  return { nextRow: row + 2, subtotalRow };
}

function writeGroupSection(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  group: AhspGroup,
): { nextRow: number; subtotalRow: number } {
  let row = startRow;
  const sectionLabel = GROUP_SECTION_LABEL[group.type];

  const title = sheet.getRow(row);
  title.getCell(1).value = sectionLabel;
  title.getCell(1).font = { bold: true };
  row += 1;

  writeHeaderRow(sheet, row);
  row += 1;

  const firstSumRow = row;
  for (const component of group.components) {
    writeComponentRow(sheet, row, component);
    row += 1;
  }
  const lastSumRow = group.components.length > 0 ? row - 1 : row;
  const subtotalRow = writeSubtotalRow(
    sheet,
    row,
    sectionLabel,
    firstSumRow,
    lastSumRow,
    group.total,
  );
  row += 2;

  return { nextRow: row, subtotalRow };
}

/**
 * Build an RAB-style worksheet from an {@link HSPResult}.
 */
function buildRabWorksheet(workbook: ExcelJS.Workbook, result: HSPResult): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet('RAB');

  sheet.columns = [
    { width: 42 },
    { width: 10 },
    { width: 14 },
    { width: 16 },
    { width: 18 },
  ];

  let row = 1;
  const title = sheet.getRow(row);
  title.getCell(1).value = `${result.kode_ahsp} — ${result.nama}`;
  title.getCell(1).font = { bold: true, size: 12 };
  row += 1;

  const meta = sheet.getRow(row);
  meta.getCell(1).value = `Satuan pekerjaan: ${result.satuan_bayar}`;
  row += 2;

  const subtotalRows: number[] = [];
  for (const group of result.groups) {
    const section = writeGroupSection(sheet, row, group);
    row = section.nextRow;
    subtotalRows.push(section.subtotalRow);
  }
  if (result.subAhsp.length > 0) {
    const sub = writeSubAhspSection(sheet, row, result);
    row = sub.nextRow;
    subtotalRows.push(sub.subtotalRow);
  }

  const { overheadValue, profitValue } = splitMargin(result);

  const recapTitle = sheet.getRow(row);
  recapTitle.getCell(1).value = 'Rekapitulasi';
  recapTitle.getCell(1).font = { bold: true };
  row += 1;

  const directLabel = result.subAhsp.length > 0
    ? 'Biaya Langsung (A+B+C+D)'
    : 'Biaya Langsung (A+B+C)';
  const directFormula =
    subtotalRows.length > 0
      ? subtotalRows.map((r) => `E${r}`).join('+')
      : String(result.baseTotal);
  const directRow = writeSummaryRow(
    sheet,
    row,
    directLabel,
    subtotalRows.length > 0
      ? { formula: directFormula, result: result.baseTotal }
      : result.baseTotal,
  );
  row += 1;
  const overheadRow = writeSummaryRow(
    sheet,
    row,
    `Overhead (${result.overheadPct}%)`,
    {
      formula: `E${directRow}*${result.overheadPct}/100`,
      result: overheadValue,
    },
  );
  row += 1;
  const profitRow = writeSummaryRow(sheet, row, `Profit (${result.profitPct}%)`, {
    formula: `E${directRow}*${result.profitPct}/100`,
    result: profitValue,
  });
  row += 1;
  writeSummaryRow(
    sheet,
    row,
    'Harga Satuan Pekerjaan',
  {
      formula: `E${directRow}+E${overheadRow}+E${profitRow}`,
      result: result.grandTotal,
    },
    { bold: true },
  );

  return sheet;
}

/**
 * Export {@link HSPResult} to an Excel workbook buffer (RAB layout).
 *
 * Columns: Uraian, Satuan, Koefisien, Harga Satuan, Jumlah — with sections
 * Tenaga Kerja (L), Bahan (M), Peralatan (E), subtotals, overhead, profit,
 * and grand total. Kolom Jumlah memakai formula Excel (koef × harga, SUM, rekapitulasi).
 */
export async function exportHspToExcelBuffer(result: HSPResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '@ahs-id/core';
  workbook.created = new Date();

  buildRabWorksheet(workbook, result);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
