import ExcelJS from 'exceljs';
import { describe, it, expect } from 'vitest';
import type { HSPResult } from '../../types/index.js';
import { exportHspToExcelBuffer } from '../excel.js';

/** Representative HSP snapshot (3.2.1-style breakdown) — avoids workspace bundle deps in @ahs-id/core tests. */
function mockHspResult(): HSPResult {
  const tkTotal = 0.065 * 135_000 + 0.007 * 210_000;
  const bahanTotal = 1.025 * 425_000;
  const peralatanTotal = 450_000;
  const baseTotal = tkTotal + bahanTotal + peralatanTotal;
  const overheadPct = 10;
  const profitPct = 5;
  const overheadProfitValue = baseTotal * 0.15;
  const grandTotal = baseTotal + overheadProfitValue;

  return {
    kode_ahsp: '3.2.1',
    nama: 'Lapis Pondasi Agregat Kelas A (CBR Min 90%)',
    satuan_bayar: 'm3',
    groups: [
      {
        type: 'L',
        title: 'Tenaga Kerja',
        total: tkTotal,
        components: [
          {
            ref: 'L.01',
            type: 'L',
            nama: 'Pekerja',
            satuan: 'OH',
            coefficient: 0.065,
            unit_price: 135_000,
            total_price: 0.065 * 135_000,
          },
        ],
      },
      {
        type: 'M',
        title: 'Bahan',
        total: bahanTotal,
        components: [
          {
            ref: 'M.09.a',
            type: 'M',
            nama: 'Agregat Kelas A',
            satuan: 'm3',
            coefficient: 1.025,
            unit_price: 425_000,
            total_price: bahanTotal,
          },
        ],
      },
      {
        type: 'E',
        title: 'Peralatan',
        total: peralatanTotal,
        components: [
          {
            ref: 'E.11',
            type: 'E',
            nama: 'Wheel Loader',
            satuan: 'jam',
            coefficient: 0.5,
            unit_price: 900_000,
            total_price: peralatanTotal,
          },
        ],
      },
    ],
    baseTotal,
    overheadPct,
    profitPct,
    overheadProfitValue,
    grandTotal,
    warnings: [],
    audit_trail: [],
  };
}

async function loadWorksheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet('RAB');
  if (!sheet) {
    throw new Error('RAB worksheet missing');
  }
  return sheet;
}

function findRowWithLabel(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row | undefined {
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    const cell = sheet.getRow(row).getCell(1).value;
    if (typeof cell === 'string' && cell.includes(label)) {
      return sheet.getRow(row);
    }
  }
  return undefined;
}

describe('exportHspToExcelBuffer', () => {
  it('exports HSP breakdown in RAB column layout', async () => {
    const result = mockHspResult();
    const buffer = await exportHspToExcelBuffer(result);
    expect(buffer.byteLength).toBeGreaterThan(0);

    const sheet = await loadWorksheet(buffer);

    expect(sheet.getRow(1).getCell(1).value).toBe('3.2.1 — Lapis Pondasi Agregat Kelas A (CBR Min 90%)');
    expect(String(sheet.getRow(2).getCell(1).value)).toContain('m3');

    const headerRow = findRowWithLabel(sheet, 'Uraian');
    expect(headerRow?.getCell(2).value).toBe('Satuan');
    expect(headerRow?.getCell(3).value).toBe('Koefisien');
    expect(headerRow?.getCell(4).value).toBe('Harga Satuan');
    expect(headerRow?.getCell(5).value).toBe('Jumlah');

    expect(findRowWithLabel(sheet, 'A. Tenaga Kerja')).toBeDefined();
    expect(findRowWithLabel(sheet, 'B. Bahan')).toBeDefined();
    expect(findRowWithLabel(sheet, 'C. Peralatan')).toBeDefined();

    const tkSubtotal = findRowWithLabel(sheet, 'Subtotal A. Tenaga Kerja');
    expect(tkSubtotal?.getCell(5).value).toBeCloseTo(result.groups[0]!.total, 0);

    const biayaLangsung = findRowWithLabel(sheet, 'Biaya Langsung');
    expect(biayaLangsung?.getCell(5).value).toBeCloseTo(result.baseTotal, 0);

    const hspRow = findRowWithLabel(sheet, 'Harga Satuan Pekerjaan');
    expect(hspRow?.getCell(5).value).toBeCloseTo(result.grandTotal, 0);
    expect(result.grandTotal).toBeCloseTo(result.baseTotal * 1.15, 0);
  });
});
