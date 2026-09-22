import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const cwd = mkdtempSync(join(tmpdir(), 'ahs-cli-'));
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('validate command from another directory', () => {
  it('validates installed packages and prints JSON only', () => {
    const result = run(['validate', '--bundle', 'pupr-2023', '--json']);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('Bundle Validation Results');
    const parsed = JSON.parse(result.stdout) as Array<{ packageName: string; status: string }>;
    expect(parsed).toEqual([expect.objectContaining({ packageName: 'pupr-2023', status: 'ok' })]);
  });

  it('returns JSON and a nonzero status for an unknown package', () => {
    const result = run(['validate', '--bundle', 'nope', '--json']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout) as Array<{ status: string; message: string }>;
    expect(parsed[0]?.status).toBe('fail');
    expect(parsed[0]?.message).toContain('Unknown bundle');
  });

  it('validates a syntax-only installed bundle', () => {
    const result = run(['validate', '--bundle', 'bina-marga-2016', '--json']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<{ status: string }>;
    expect(parsed[0]?.status).toBe('ok');
  });
});
