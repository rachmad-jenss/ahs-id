/**
 * Run SE 47 full PDF spot-checks (SDA, BM, CK). Long-running — resumable.
 *
 *   node scripts/run-se47-full-check.mjs
 *   node scripts/run-se47-full-check.mjs --no-resume
 *   node scripts/run-se47-full-check.mjs --only CK
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const script = join(ROOT, 'tools', 'docling', 'scripts', 'run-full-check-all.ps1');
const ps = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const extra = process.argv.slice(2);
const r = spawnSync(
  ps,
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...extra],
  { cwd: ROOT, stdio: 'inherit' },
);
process.exit(r.status ?? 1);
