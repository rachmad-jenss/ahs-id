import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';

export type PackageDataMode = 'schema' | 'syntax';

export interface PackageDataFileResult {
  readonly file: string;
  readonly status: 'ok' | 'fail' | 'skip';
  readonly message: string;
}

export interface PackageDataReport {
  readonly valid: boolean;
  readonly files: readonly PackageDataFileResult[];
}

const SCHEMA_FILES = {
  'tenaga-kerja': 'tenaga-kerja.schema.json',
  'bahan-master': 'bahan-master.schema.json',
  'peralatan-master': 'peralatan-master.schema.json',
  'faktor-konversi': 'faktor-konversi.schema.json',
  'ahsp-item': 'ahsp-item.schema.json',
  'hsd-regional': 'hsd-regional.schema.json',
  'hsd-acuan': 'hsd-acuan.schema.json',
} as const;

type SchemaKey = keyof typeof SCHEMA_FILES;

let compiled: Record<SchemaKey, ValidateFunction> | undefined;

function schemaDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'schemas');
}

function validators(): Record<SchemaKey, ValidateFunction> {
  if (compiled) return compiled;
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
  const dir = schemaDirectory();
  const next = {} as Record<SchemaKey, ValidateFunction>;
  for (const key of Object.keys(SCHEMA_FILES) as SchemaKey[]) {
    const path = join(dir, SCHEMA_FILES[key]);
    next[key] = ajv.compile(JSON.parse(readFileSync(path, 'utf8')) as object);
  }
  compiled = next;
  return next;
}

function detectSchema(filePath: string): SchemaKey | null {
  const name = basename(filePath, '.json');
  if (name === 'tenaga-kerja') return 'tenaga-kerja';
  if (name === 'bahan-master') return 'bahan-master';
  if (name === 'peralatan-master') return 'peralatan-master';
  if (name === 'faktor-konversi') return 'faktor-konversi';
  if (name === 'hsd') return 'hsd-regional';
  if (name === 'hsd-acuan') return 'hsd-acuan';
  if (name === 'items') return 'ahsp-item';
  if (name === 'peralatan-hsd') return null;
  return 'ahsp-item';
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

function formatErrors(errors: ErrorObject[] | null | undefined, prefix: string): string {
  const list = errors ?? [];
  const shown = list.slice(0, 3).map((err) => `${prefix}${err.instancePath || '/'} ${err.message ?? 'invalid'}`);
  if (list.length > 3) shown.push(`${prefix}... (more errors omitted)`);
  return shown.join('; ');
}

/**
 * Validate JSON files in a package `data/` directory.
 * `schema` applies the core JSON Schemas. `syntax` only checks that each file parses.
 * Paths are resolved from the compiled package, not from the caller working directory.
 */
export function validatePackageData(dataDir: string, mode: PackageDataMode = 'schema'): PackageDataReport {
  if (!statSync(dataDir, { throwIfNoEntry: false })?.isDirectory()) {
    return {
      valid: false,
      files: [{ file: dataDir, status: 'fail', message: 'data directory not found' }],
    };
  }

  const files = collectJsonFiles(dataDir);
  if (files.length === 0) {
    return {
      valid: false,
      files: [{ file: dataDir, status: 'fail', message: 'no JSON files found' }],
    };
  }

  const results: PackageDataFileResult[] = [];
  for (const file of files) {
    const rel = relative(dataDir, file);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    } catch (err) {
      results.push({
        file: rel,
        status: 'fail',
        message: `invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
      });
      continue;
    }

    if (mode === 'syntax') {
      const count = Array.isArray(data) ? ` (${data.length} items)` : '';
      results.push({ file: rel, status: 'ok', message: `json syntax${count}` });
      continue;
    }

    const schemaKey = detectSchema(file);
    if (schemaKey === null) {
      results.push({ file: rel, status: 'skip', message: 'no JSON schema (bundle-specific)' });
      continue;
    }

    const validate = validators()[schemaKey];
    const items = Array.isArray(data) && schemaKey === 'ahsp-item' ? data : [data];
    const problems: string[] = [];
    for (let idx = 0; idx < items.length; idx++) {
      if (validate(items[idx])) continue;
      const prefix = Array.isArray(data) ? `[${idx}] ` : '';
      problems.push(formatErrors(validate.errors, prefix));
      if (problems.length >= 3) break;
    }
    if (problems.length === 0) {
      const count = Array.isArray(data) ? ` (${data.length} items)` : '';
      results.push({ file: rel, status: 'ok', message: `${schemaKey}${count}` });
    } else {
      results.push({ file: rel, status: 'fail', message: `${schemaKey}: ${problems.join('; ')}` });
    }
  }

  return { valid: results.every((file) => file.status !== 'fail'), files: results };
}
