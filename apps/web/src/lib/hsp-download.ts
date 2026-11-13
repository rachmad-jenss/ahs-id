import type { HSPResult } from '@ahs-id/core';
import { exportHspToExcelBuffer } from '@ahs-id/core/excel';
import ExcelJS from 'exceljs';
import type { PortalHspResult } from '@/lib/portal-hsp';
import { portalResultToTsv } from '@/lib/hsp-rab-tsv';
export { copyTextToClipboard } from '@/lib/clipboard';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileName(kode: string): string {
  return kode.replace(/[^\w.-]+/g, '_').slice(0, 48);
}

export async function downloadEngineHspExcel(result: HSPResult): Promise<void> {
  const buffer = await exportHspToExcelBuffer(result);
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `HSP-${safeFileName(result.kode_ahsp)}.xlsx`);
}

/** Portal: bangun workbook ringan dengan formula kolom Jumlah. */
export async function downloadPortalHspExcel(result: PortalHspResult): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('RAB');
  const tsv = portalResultToTsv(result, 'formulas');
  let row = 1;
  for (const line of tsv.split('\n')) {
    if (!line.trim()) {
      row += 1;
      continue;
    }
    const cells = line.split('\t');
    const data = sheet.getRow(row);
    cells.forEach((value, index) => {
      const cell = data.getCell(index + 1);
      if (value.startsWith('=')) {
        cell.value = { formula: value.slice(1) };
      } else if (value && !Number.isNaN(Number(value)) && index > 1) {
        cell.value = Number(value);
      } else {
        cell.value = value;
      }
    });
    row += 1;
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `HSP-portal-${safeFileName(result.kode)}.xlsx`);
}

