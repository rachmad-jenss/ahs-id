import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { exportHspToExcelBuffer } from '@ahs-id/core';
import { calculateHsp, parseKeyValue } from '../utils/loader.js';

export function exportRabCommand(): Command {
  const cmd = new Command('export-rab')
    .description('Export HSP calculation to an Excel RAB file')
    .argument('<kode-ahsp>', 'AHSP item code (e.g. 3.2.1)')
    .option('-b, --bundle <name>', 'AHSP regulation bundle (default: pupr-2023)', 'pupr-2023')
    .option('--hsd <name>', 'HSD price bundle (default: hsd-kaltim-2025 for pupr-2023, hsd-bm-2022 for bina-marga-2022)')
    .option('-o, --output <path>', 'Output Excel file path (default: <kode-ahsp>.xlsx)')
    .option('-v, --variable <key=value...>', 'Input variables (e.g. jarak_quarry_km=25)')
    .action(async (kodeAhsp: string, options: { bundle: string; hsd?: string; output?: string; variable?: string[] }) => {
      try {
        const variables: Record<string, string | number> = {};
        if (options.variable) {
          for (const kv of options.variable) {
            Object.assign(variables, parseKeyValue(kv));
          }
        }

        const { result } = await calculateHsp(options.bundle, kodeAhsp, options.hsd, variables);
        const buffer = await exportHspToExcelBuffer(result);

        const outputPath = options.output ?? defaultExcelName(kodeAhsp);
        writeFileSync(outputPath, buffer);
        console.log(`RAB exported to ${outputPath}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}

function defaultExcelName(kodeAhsp: string): string {
  if (kodeAhsp.includes('/') || kodeAhsp.includes('\\') || kodeAhsp.includes('..')) {
    throw new Error('kode-ahsp cannot contain a path. Pass --output to choose a file path.');
  }
  return `${kodeAhsp}.xlsx`;
}
