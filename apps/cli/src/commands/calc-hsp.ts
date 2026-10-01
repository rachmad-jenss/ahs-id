import { Command } from 'commander';
import { calculateHsp, formatIdr, listAvailableBundles, listAvailableHsd, parseKeyValue } from '../utils/loader.js';

export function wrapTerminalText(value: string, width: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) lines.push(current);
      current = '';
      let remainder = word;
      while (remainder.length > width) {
        lines.push(remainder.slice(0, width));
        remainder = remainder.slice(width);
      }
      current = remainder;
      continue;
    }

    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function formatTerminalContinuation(value: string): string {
  return `  ↳ ${value}`;
}

export function calcHspCommand(): Command {
  const cmd = new Command('calc-hsp')
    .description('Calculate HSP (Harga Satuan Pekerjaan) for an AHSP item')
    .argument('[kode-ahsp]', 'AHSP item code (e.g. 3.2.1; omit with --list-bundles)')
    .option('-b, --bundle <name>', 'AHSP regulation bundle (default: pupr-2023)', 'pupr-2023')
    .option('--hsd <name>', 'HSD price bundle (default: hsd-kaltim-2025 for pupr-2023, hsd-bm-2022 for bina-marga-2022)')
    .option('--json', 'Output as JSON instead of formatted table')
    .option('-v, --variable <key=value...>', 'Input variables (e.g. jarak_quarry_km=25 kondisi_jalan=sedang)')
    .option('--list-bundles', 'List available regulation bundles')
    .action(async (kodeAhsp: string | undefined, options: { bundle: string; hsd?: string; json: boolean; variable?: string[]; listBundles?: boolean }) => {
      if (options.listBundles) {
        console.log('Available bundles:');
        for (const name of listAvailableBundles()) {
          console.log(`  ${name}`);
        }
        console.log('Available HSD:');
        for (const name of listAvailableHsd()) {
          console.log(`  ${name}`);
        }
        return;
      }

      if (!kodeAhsp) {
        console.error('Error: kode-ahsp is required unless --list-bundles is used.');
        process.exitCode = 1;
        return;
      }

      try {
        const variables: Record<string, string | number> = {};
        if (options.variable) {
          for (const kv of options.variable) {
            Object.assign(variables, parseKeyValue(kv));
          }
        }
        const { result, hsdName } = await calculateHsp(options.bundle, kodeAhsp, options.hsd, variables);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        // Formatted table output
        const sep = '─'.repeat(72);
        console.log(`\n${result.kode_ahsp} — ${result.nama}`);
        console.log(`Satuan: ${result.satuan_bayar}`);
        console.log(hsdName ? `HSD: ${hsdName}` : 'HSD: embedded in the bundle');
        console.log(sep);

        for (const group of result.groups) {
          const label = group.type === 'L' ? 'A. Tenaga Kerja'
            : group.type === 'M' ? 'B. Bahan'
            : 'C. Peralatan';
          console.log(`\n${label}`);
          console.log(`  ${'Uraian'.padEnd(38)} ${'Satuan'.padEnd(8)} ${'Koefisien'.padEnd(12)} ${'Harga Satuan'.padEnd(14)} ${'Jumlah'}`);
          for (const comp of group.components) {
            const wrappedLines = wrapTerminalText(comp.nama || comp.ref, 38);
            const firstLine = wrappedLines[0] ?? '';
            const continuationLines = wrappedLines.slice(1);
            console.log(`  ${firstLine.padEnd(38)} ${comp.satuan.padEnd(8)} ${String(comp.coefficient).padEnd(12)} ${formatIdr(comp.unit_price).padStart(12)} ${formatIdr(comp.total_price).padStart(14)}`);
            for (const line of continuationLines) {
              console.log(formatTerminalContinuation(line));
            }
          }
          console.log(`  ${'Subtotal'.padEnd(74)} ${formatIdr(group.total).padStart(14)}`);
        }

        console.log(`\n${sep}`);
        console.log(`  Biaya Langsung (A+B+C)${' '.repeat(44)} ${formatIdr(result.baseTotal).padStart(14)}`);
        console.log(`  Overhead (${result.overheadPct}%)${' '.repeat(49)} ${formatIdr(result.baseTotal * (result.overheadPct / 100)).padStart(14)}`);
        console.log(`  Profit (${result.profitPct}%)${' '.repeat(51)} ${formatIdr(result.baseTotal * (result.profitPct / 100)).padStart(14)}`);
        console.log(`  ${'Harga Satuan Pekerjaan'.padEnd(58)} ${formatIdr(result.grandTotal).padStart(14)}`);
        console.log(sep);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}
