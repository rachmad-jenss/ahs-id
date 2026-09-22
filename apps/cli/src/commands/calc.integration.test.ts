import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

function run(args: string[], cwd = mkdtempSync(join(tmpdir(), 'ahs-cli-'))): { status: number | null; stdout: string; stderr: string; cwd: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, cwd };
}

describe('calc-hsp from another directory', () => {
  it('compiled CLI entry keeps the Node shebang', () => {
    const firstLine = readFileSync(cli, 'utf8').split(/\r?\n/, 1)[0];
    expect(firstLine).toBe('#!/usr/bin/env node');
  });

  it('prices Bina Marga 2016 item 3.1.1 from the Kaltim HSD', () => {
    const result = run(['calc-hsp', '3.1.1', '--bundle', 'bina-marga-2016', '--json']);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { grandTotal: number };
    expect(parsed.grandTotal).toBeCloseTo(32401.25, 2);
  });

  it('prices a unique Cipta Karya item without an HSD', () => {
    const result = run(['calc-hsp', '1.2.1.1.1', '--bundle', 'cipta-karya-2024', '--json']);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { grandTotal: number };
    expect(parsed.grandTotal).toBeCloseTo(82_600 * 1.15, 0);
  });

  it('rejects a duplicated Cipta Karya code', () => {
    const result = run(['calc-hsp', '6.6.1.1', '--bundle', 'cipta-karya-2024', '--json']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not unique');
  });

  it('rejects a non-numeric Cipta Karya margin override', () => {
    const result = run([
      'calc-hsp',
      '1.2.1.1.1',
      '--bundle',
      'cipta-karya-2024',
      '--variable',
      'overhead_pct=abc',
      '--json',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('overhead_pct must be a finite number');
  });

  it('rejects --hsd for Cipta Karya', () => {
    const result = run(['calc-hsp', '1.2.1.1.1', '--bundle', 'cipta-karya-2024', '--hsd', 'hsd-kaltim-2025']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('does not use an HSD');
  });

  it('exports a Bina Marga 2016 workbook', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ahs-cli-'));
    const output = join(cwd, 'rab.xlsx');
    const result = run(['export-rab', '3.1.1', '--bundle', 'bina-marga-2016', '--output', output], cwd);
    expect(result.status, result.stderr).toBe(0);
    expect(statSync(output).size).toBeGreaterThan(1000);
  });
});
