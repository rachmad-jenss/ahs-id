import ExcelJS from 'exceljs';
import { describe, it, expect } from 'vitest';
import { createCalculator } from '../../calculator/hsp.js';
import { exportHspToExcelBuffer } from '../excel.js';
import { bundle } from '@ahs-id/pupr-2023';
import { hsd } from '@ahs-id/hsd-kaltim-2025';

const VARIABEL_3_2_1 = {
  jarak_quarry_km: 25,
  jarak_sumber_air_km: 8,
  kondisi_jalan: 'sedang',
  jenis_material: 'agregat_kelas_a',
  faktor_efisiensi: 0.83,
  kondisi_operasi: 'normal',
  tebal_hamparan_m: 0.2,
  jumlah_passing: 6,
  lebar_hamparan_m: 3.0,
  jumlah_lintasan: 6,
} as const;

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
  it('exports 3.2.1 with Kaltim HSD in RAB layout', async () => {
    const calc = createCalculator(bundle, hsd);
    const result = calc.hitungHSP('3.2.1', { ...VARIABEL_3_2_1 });

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
