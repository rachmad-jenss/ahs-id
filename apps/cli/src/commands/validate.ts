import { Command } from 'commander';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

interface ValidationResult {
  packageName: string;
  status: 'ok' | 'fail' | 'skip';
  message: string;
}

export function validateCommand(): Command {
  const cmd = new Command('validate')
    .description('Validate AHSP data bundles against JSON schemas')
    .option('-b, --bundle <name>', 'Validate a specific bundle package')
    .option('--json', 'Output as JSON')
    .action(async (options: { bundle?: string; json: boolean }) => {
      try {
        const results: ValidationResult[] = [];
        const root = resolve(process.cwd());

        const packagesToValidate = options.bundle
          ? [options.bundle]
          : ['pupr-2023', 'bina-marga-2016', 'bina-marga-2022', 'cipta-karya-2024',
             'hsd-kaltim-2025', 'hsd-jabar-2025', 'hsd-papua-2025'];

        for (const pkgName of packagesToValidate) {
          const pkgDir = resolve(root, 'packages', pkgName);
          if (!statSync(pkgDir, { throwIfNoEntry: false })?.isDirectory()) {
            results.push({ packageName: pkgName, status: 'fail', message: `package directory not found at packages/${pkgName}` });
            continue;
          }

          const dataDir = resolve(pkgDir, 'data');
          if (!statSync(dataDir, { throwIfNoEntry: false })?.isDirectory()) {
            results.push({ packageName: pkgName, status: 'fail', message: 'missing data/ directory' });
            continue;
          }

          const jsonFiles = collectJsonFiles(dataDir);
          if (jsonFiles.length === 0) {
            results.push({ packageName: pkgName, status: 'skip', message: 'no JSON files found in data/' });
            continue;
          }

          let fileErrors = 0;
          for (const file of jsonFiles) {
            try {
              const content = readFileSync(file, 'utf-8');
              JSON.parse(content);
            } catch (e) {
              fileErrors++;
              results.push({ packageName: pkgName, status: 'fail', message: `invalid JSON: ${relative(root, file)} — ${(e as Error).message}` });
            }
          }

          if (fileErrors === 0) {
            results.push({
              packageName: pkgName,
              status: 'ok',
              message: `${jsonFiles.length} JSON file(s) — syntax OK. Run \`pnpm validate-data\` for full schema validation.`,
            });
          }
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        console.log('\nBundle Validation Results:\n');
        for (const r of results) {
          const icon = r.status === 'ok' ? '✓' : r.status === 'skip' ? '–' : '✗';
          console.log(`  ${icon} ${r.packageName}: ${r.message}`);
        }

        const failed = results.filter(r => r.status === 'fail');
        if (failed.length > 0) {
          console.log(`\n${failed.length} package(s) failed validation.`);
          process.exit(1);
        } else {
          console.log('\nAll packages passed syntax validation.');
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  return cmd;
}

function collectJsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}
