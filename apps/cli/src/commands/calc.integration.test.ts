import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

  it('lists bundles without requiring an item code', () => {
    const result = run(['calc-hsp', '--list-bundles']);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Bundle tersedia:');
    expect(result.stdout).toContain('pupr-2023');
    expect(result.stdout).toContain('HSD tersedia:');
  });

  it('emits parseable JSON for bundle discovery', () => {
    const result = run(['calc-hsp', '--list-bundles', '--json']);

    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { bundles: string[]; hsd: string[] };
    expect(parsed.bundles).toContain('pupr-2023');
    expect(parsed.hsd).toContain('hsd-kaltim-2025');
  });

  it('emits parseable JSON for calculation errors', () => {
    const result = run(['calc-hsp', 'missing', '--bundle', 'not-a-bundle', '--json']);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({ error: expect.stringContaining('Unknown bundle') });
  });

  it('emits parseable JSON when an item code is missing', () => {
    const result = run(['calc-hsp', '--json']);

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ error: expect.stringContaining('kode-ahsp') });
  });

  it('emits parseable JSON for Commander parse errors', () => {
    const result = run(['calc-hsp', '--json', '--unknown-option']);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({ error: expect.stringContaining('unknown option') });
  });

  it('does not append a help screen to human-readable parse errors', () => {
    const result = run(['calc-hsp', '--unknown-option']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown option');
    expect(result.stderr).not.toContain('Usage:');
  });

  it('does not append an output marker after Commander prints root help', () => {
    const result = run([]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: ahs-id');
    expect(result.stderr).not.toContain('(outputHelp)');
  });

  it('emits parseable JSON when an option value is missing', () => {
    const result = run(['calc-hsp', '--json', '--bundle']);

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ error: expect.stringContaining('argument missing') });
  });

  it('labels human-readable money values as Rupiah', () => {
    const result = run(['calc-hsp', '3.1.1', '--bundle', 'bina-marga-2016']);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Rp ');
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

  it('lists SE Binkon 47/2026 bidang bundles', () => {
    const result = run(['calc-hsp', '--list-bundles', '--json']);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { bundles: string[] };
    expect(parsed.bundles).toContain('sda-se-binkon-47-2026');
    expect(parsed.bundles).toContain('bina-marga-se-binkon-47-2026');
    expect(parsed.bundles).toContain('cipta-karya-se-binkon-47-2026');
  });

  it('runs fixed-coefficient calc for SE Binkon SDA (template harga 0)', () => {
    const result = run(['calc-hsp', 'A.1.01.a', '--bundle', 'sda-se-binkon-47-2026', '--json']);
    expect(result.status, result.stderr).toBe(0);
    const parsed = JSON.parse(result.stdout) as { grandTotal: number };
    expect(parsed.grandTotal).toBe(0);
  });

  it('exports a Bina Marga 2016 workbook', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ahs-cli-'));
    const output = join(cwd, 'rab.xlsx');
    const result = run(['export-rab', '3.1.1', '--bundle', 'bina-marga-2016', '--output', output], cwd);
    expect(result.status, result.stderr).toBe(0);
    expect(statSync(output).size).toBeGreaterThan(1000);
  });

  it('refuses to overwrite an existing workbook without --force', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ahs-cli-'));
    const output = join(cwd, 'rab.xlsx');
    writeFileSync(output, 'keep this file');

    const refused = run(['export-rab', '3.1.1', '--bundle', 'bina-marga-2016', '--output', output], cwd);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('--force');
    expect(readFileSync(output, 'utf8')).toBe('keep this file');

    const forced = run(['export-rab', '3.1.1', '--bundle', 'bina-marga-2016', '--output', output, '--force'], cwd);
    expect(forced.status, forced.stderr).toBe(0);
    expect(statSync(output).size).toBeGreaterThan(1000);
  });
});
