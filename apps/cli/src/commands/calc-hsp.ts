import { Command } from 'commander';
import { calculateHsp, formatIdr, listAvailableBundles, listAvailableHsd, parseKeyValue } from '../utils/loader.js';

/** Wrap a terminal description into lines no wider than the requested column. */
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

/** Mark a wrapped terminal line as a continuation of the previous component. */
export function formatTerminalContinuation(value: string): string {
  return `  ↳ ${value}`;
}

export interface TerminalLayout {
  readonly descriptionWidth: number;
  readonly separatorWidth: number;
  readonly compact: boolean;
}

/** Select readable table or stacked output dimensions for the current terminal. */
export function getTerminalLayout(terminalWidth = process.stdout.columns ?? 80): TerminalLayout {
  const width = Number.isFinite(terminalWidth) ? Math.max(40, Math.floor(terminalWidth)) : 80;
  return {
    descriptionWidth: Math.max(20, Math.min(38, width - 52)),
    separatorWidth: Math.max(48, Math.min(72, width)),
    compact: width < 76,
  };
}

export interface TerminalComponentRow {
  readonly nama?: string;
  readonly ref: string;
  readonly satuan: string;
  readonly coefficient: number;
  readonly unit_price: number;
  readonly total_price: number;
}

/** Format one calculation component for either table or compact terminal output. */
export function formatTerminalComponentLines(component: TerminalComponentRow, layout: TerminalLayout): string[] {
  const wrappedLines = wrapTerminalText(component.nama || component.ref, layout.descriptionWidth);
  if (layout.compact) {
    return [
      ...wrappedLines.map((line, index) => index === 0 ? `  ${line}` : formatTerminalContinuation(line)),
      `    Satuan: ${component.satuan}`,
      `    Koefisien: ${component.coefficient}`,
      `    Harga satuan: ${formatIdr(component.unit_price)}`,
      `    Jumlah: ${formatIdr(component.total_price)}`,
    ];
  }

  const firstLine = wrappedLines[0] ?? '';
  return [
    `  ${firstLine.padEnd(layout.descriptionWidth)} ${component.satuan.padEnd(8)} ${String(component.coefficient).padEnd(12)} ${formatIdr(component.unit_price).padStart(12)} ${formatIdr(component.total_price).padStart(14)}`,
    ...wrappedLines.slice(1).map(formatTerminalContinuation),
  ];
}

/** Emit a user-facing calculation error while preserving the selected output contract. */
function emitCommandError(message: string, json: boolean): void {
  console.error(json ? JSON.stringify({ error: message }) : `Error: ${message}`);
  process.exitCode = 1;
}

/** Build the Commander command for AHSP calculation and bundle discovery. */
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
        const bundles = listAvailableBundles();
        const hsd = listAvailableHsd();
        if (options.json) {
          console.log(JSON.stringify({ bundles, hsd }, null, 2));
          return;
        }
        console.log('Bundle tersedia:');
        for (const name of bundles) {
          console.log(`  ${name}`);
        }
        console.log('HSD tersedia:');
        for (const name of hsd) {
          console.log(`  ${name}`);
        }
        return;
      }

      if (!kodeAhsp) {
        emitCommandError('kode-ahsp wajib diisi kecuali saat memakai --list-bundles.', options.json);
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
        const layout = getTerminalLayout();
        const sep = '─'.repeat(layout.separatorWidth);
        const totalLabelWidth = Math.max(24, layout.separatorWidth - 17);
        console.log(`\n${result.kode_ahsp} — ${result.nama}`);
        console.log(`Satuan: ${result.satuan_bayar}`);
        console.log(hsdName ? `HSD: ${hsdName}` : 'HSD: tertanam dalam bundle');
        console.log(sep);

        for (const group of result.groups) {
          const label = group.type === 'L' ? 'A. Tenaga Kerja'
            : group.type === 'M' ? 'B. Bahan'
            : 'C. Peralatan';
          console.log(`\n${label}`);
          if (!layout.compact) {
            console.log(`  ${'Uraian'.padEnd(layout.descriptionWidth)} ${'Satuan'.padEnd(8)} ${'Koefisien'.padEnd(12)} ${'Harga Satuan'.padEnd(14)} ${'Jumlah'}`);
          }
          for (const comp of group.components) {
            for (const line of formatTerminalComponentLines(comp, layout)) console.log(line);
          }
          console.log(layout.compact ? `  Subtotal: ${formatIdr(group.total)}` : `  ${'Subtotal'.padEnd(totalLabelWidth)} ${formatIdr(group.total).padStart(14)}`);
        }

        console.log(`\n${sep}`);
        const printTotal = (label: string, value: number): void => {
          console.log(layout.compact ? `  ${label}: ${formatIdr(value)}` : `  ${label.padEnd(totalLabelWidth)} ${formatIdr(value).padStart(14)}`);
        };
        printTotal('Biaya Langsung (A+B+C)', result.baseTotal);
        printTotal(`Overhead (${result.overheadPct}%)`, result.baseTotal * (result.overheadPct / 100));
        printTotal(`Profit (${result.profitPct}%)`, result.baseTotal * (result.profitPct / 100));
        printTotal('Harga Satuan Pekerjaan', result.grandTotal);
        console.log(sep);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emitCommandError(message, options.json);
      }
    });

  return cmd;
}
