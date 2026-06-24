import { Command } from 'commander';
import { resolveBundle, parseKeyValue } from '../utils/loader.js';

export function exportRabCommand(): Command {
  const cmd = new Command('export-rab')
    .description('Export HSP calculation to an Excel RAB file')
    .argument('<kode-ahsp>', 'AHSP item code (e.g. 3.2.1)')
    .option('-b, --bundle <name>', 'AHSP regulation bundle (default: pupr-2023)', 'pupr-2023')
    .option('--hsd <name>', 'HSD regional price bundle (default: hsd-kaltim-2025)', 'hsd-kaltim-2025')
    .option('-o, --output <path>', 'Output Excel file path (default: <kode-ahsp>.xlsx)')
    .option('-v, --variable <key=value...>', 'Input variables (e.g. jarak_quarry_km=25)')
    .action(async (kodeAhsp: string, options: { bundle: string; hsd: string; output?: string; variable?: string[] }) => {
      try {
        const { bundle, hsd } = await resolveBundle(options.bundle);
        const variables: Record<string, string | number> = {};

        if (options.variable) {
          for (const kv of options.variable) {
            Object.assign(variables, parseKeyValue(kv));
          }
        }

        const { createCalculator, exportHspToExcelBuffer } = await import('@ahs-id/core');
        const { writeFileSync } = await import('node:fs');

        const calc = createCalculator(bundle, hsd);
        const result = calc.hitungHSP(kodeAhsp, variables);
        const buffer = await exportHspToExcelBuffer(result);

        const outputPath = options.output ?? `${kodeAhsp}.xlsx`;
        writeFileSync(outputPath, buffer);
        console.log(`RAB exported to ${outputPath}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
