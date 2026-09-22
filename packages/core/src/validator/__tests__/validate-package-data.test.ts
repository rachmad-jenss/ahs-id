import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validatePackageData } from '../validate-package-data.js';

function tempDataDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'ahs-validate-'));
  const data = join(root, 'data');
  mkdirSync(data);
  return data;
}

const validLabor = {
  version: '1.0.0',
  items: [{
    kode: 'L.01',
    nama: 'Pekerja',
    satuan: 'OH',
    kualifikasi: 'non-terampil',
    jam_kerja_nominal: 7,
    jam_efektif: 5,
  }],
};

describe('validatePackageData', () => {
  it('accepts a schema-valid tenaga-kerja file', () => {
    const data = tempDataDir();
    writeFileSync(join(data, 'tenaga-kerja.json'), JSON.stringify(validLabor));
    const report = validatePackageData(data, 'schema');
    expect(report.valid).toBe(true);
    expect(report.files[0]?.status).toBe('ok');
  });

  it('rejects a schema-invalid tenaga-kerja file', () => {
    const data = tempDataDir();
    writeFileSync(join(data, 'tenaga-kerja.json'), '{}');
    const report = validatePackageData(data, 'schema');
    expect(report.valid).toBe(false);
    expect(report.files[0]?.message).toContain('tenaga-kerja');
  });

  it('rejects an invalid HSD document', () => {
    const data = tempDataDir();
    writeFileSync(join(data, 'hsd.json'), '{}');
    const report = validatePackageData(data, 'schema');
    expect(report.valid).toBe(false);
    expect(report.files[0]?.message).toContain('hsd-regional');
  });

  it('checks syntax without applying schemas', () => {
    const data = tempDataDir();
    writeFileSync(join(data, 'tenaga-kerja.json'), '{}');
    expect(validatePackageData(data, 'syntax').valid).toBe(true);
  });

  it('rejects invalid JSON in syntax mode', () => {
    const data = tempDataDir();
    writeFileSync(join(data, 'items.json'), '{');
    const report = validatePackageData(data, 'syntax');
    expect(report.valid).toBe(false);
    expect(report.files[0]?.message).toContain('invalid JSON');
  });

  it('fails when the data directory is missing', () => {
    const report = validatePackageData(join(tmpdir(), 'ahs-missing-data-dir'), 'schema');
    expect(report.valid).toBe(false);
  });

  it('ships schemas and the validator in the package tarball', () => {
    const dest = mkdtempSync(join(tmpdir(), 'ahs-core-pack-'));
    const packed = spawnSync(`pnpm pack --json --pack-destination "${dest}"`, {
      cwd: fileURLToPath(new URL('../../..', import.meta.url)),
      encoding: 'utf8',
      shell: true,
    });
    expect(packed.status, packed.stderr).toBe(0);
    const payload = JSON.parse(packed.stdout) as { files: Array<{ path: string }> };
    const paths = payload.files.map((file) => file.path);
    expect(paths).toContain('dist/validator/validate-package-data.js');
    expect(paths).toContain('schemas/ahsp-item.schema.json');
    expect(paths).toContain('schemas/hsd-regional.schema.json');
  });
});
