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
  data.getCell(5).value = component.total_price;
  data.getCell(5).numFmt = IDR_FMT;
}

function writeSubtotalRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  sectionLabel: string,
  total: number,
): void {
  const data = sheet.getRow(row);
  data.getCell(1).value = `Subtotal ${sectionLabel}`;
  data.getCell(1).font = { bold: true };
  data.getCell(4).value = 'Subtotal';
  data.getCell(4).font = { bold: true };
  data.getCell(4).alignment = { horizontal: 'right' };
  data.getCell(5).value = total;
  data.getCell(5).numFmt = IDR_FMT;
  data.getCell(5).font = { bold: true };
}

function writeSummaryRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  amount: number,
  options?: { bold?: boolean },
): void {
  const data = sheet.getRow(row);
  data.getCell(1).value = label;
  if (options?.bold) {
    data.getCell(1).font = { bold: true };
  }
  data.getCell(5).value = amount;
  data.getCell(5).numFmt = IDR_FMT;
  if (options?.bold) {
    data.getCell(5).font = { bold: true };
  }
}

function writeGroupSection(sheet: ExcelJS.Worksheet, startRow: number, group: AhspGroup): number {
  let row = startRow;
  const sectionLabel = GROUP_SECTION_LABEL[group.type];

  const title = sheet.getRow(row);
  title.getCell(1).value = sectionLabel;
  title.getCell(1).font = { bold: true };
  row += 1;

  writeHeaderRow(sheet, row);
  row += 1;

  for (const component of group.components) {
    writeComponentRow(sheet, row, component);
    row += 1;
  }

  writeSubtotalRow(sheet, row, sectionLabel, group.total);
  row += 2;

  return row;
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

  for (const group of result.groups) {
    row = writeGroupSection(sheet, row, group);
  }

  const { overheadValue, profitValue } = splitMargin(result);

  const recapTitle = sheet.getRow(row);
  recapTitle.getCell(1).value = 'Rekapitulasi';
  recapTitle.getCell(1).font = { bold: true };
  row += 1;

  writeSummaryRow(sheet, row, 'Biaya Langsung (A+B+C)', result.baseTotal);
  row += 1;
  writeSummaryRow(
    sheet,
    row,
    `Overhead (${result.overheadPct}%)`,
    overheadValue,
  );
  row += 1;
  writeSummaryRow(sheet, row, `Profit (${result.profitPct}%)`, profitValue);
  row += 1;
  writeSummaryRow(sheet, row, 'Harga Satuan Pekerjaan', result.grandTotal, { bold: true });

  return sheet;
}

/**
 * Export {@link HSPResult} to an Excel workbook buffer (RAB layout).
 *
 * Columns: Uraian, Satuan, Koefisien, Harga Satuan, Jumlah — with sections
 * Tenaga Kerja (L), Bahan (M), Peralatan (E), subtotals, overhead, profit,
 * and grand total.
 */
export async function exportHspToExcelBuffer(result: HSPResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '@ahs-id/core';
  workbook.created = new Date();

  buildRabWorksheet(workbook, result);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
