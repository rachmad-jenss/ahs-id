import { Command } from 'commander';
import { validatePackageData } from '@ahs-id/core';
import { assertKnownStrategy, findPackage, installedDataDir, PACKAGES, packageNames, type PackageRecord } from '../utils/registry.js';

export interface ValidationResult {
  packageName: string;
  status: 'ok' | 'fail';
  message: string;
}

export function validateInstalledPackages(bundleName: string | undefined): ValidationResult[] {
  if (bundleName !== undefined && !findPackage(bundleName)) {
    return [{
      packageName: bundleName,
      status: 'fail',
      message: `Unknown bundle "${bundleName}". Available: ${packageNames().join(', ')}`,
    }];
  }

  const selected = bundleName ? PACKAGES.filter((pkg) => pkg.name === bundleName) : PACKAGES;
  return selected.map(validateOne);
}

function validateOne(pkg: PackageRecord): ValidationResult {
  assertKnownStrategy(pkg.strategy);
  let dataDir: string;
  try {
    dataDir = installedDataDir(pkg.specifier);
  } catch (err) {
    return {
      packageName: pkg.name,
      status: 'fail',
      message: err instanceof Error ? err.message : 'package could not be resolved',
    };
  }

  const report = validatePackageData(dataDir, pkg.validation);
  const failed = report.files.filter((file) => file.status === 'fail');
  if (!report.valid) {
    const detail = failed.map((file) => `${file.file}: ${file.message}`).join('; ');
    return { packageName: pkg.name, status: 'fail', message: detail || 'validation failed' };
  }
  const checked = report.files.filter((file) => file.status !== 'skip').length;
  return {
    packageName: pkg.name,
    status: 'ok',
    message: `${checked} JSON file(s) — ${pkg.validation === 'schema' ? 'schema OK' : 'syntax OK'}`,
  };
}

export function validateCommand(): Command {
  const cmd = new Command('validate')
    .description('Validate installed AHSP data bundles against JSON schemas')
    .option('-b, --bundle <name>', 'Validate a specific bundle package')
    .option('--json', 'Output as JSON')
    .action((options: { bundle?: string; json?: boolean }) => {
      const json = options.json === true;
      try {
        const results = validateInstalledPackages(options.bundle);
        emit(results, json);
        if (results.some((result) => result.status === 'fail')) {
          process.exitCode = 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'validation failed';
        if (json) {
          console.log(JSON.stringify({ error: message }));
        } else {
          console.error(`Error: ${message}`);
        }
        process.exitCode = 1;
      }
    });

  return cmd;
}

function emit(results: readonly ValidationResult[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(results));
    return;
  }

  console.log('\nBundle Validation Results:\n');
  for (const result of results) {
    const icon = result.status === 'ok' ? '✓' : '✗';
    console.log(`  ${icon} ${result.packageName}: ${result.message}`);
  }
  const failed = results.filter((result) => result.status === 'fail');
  if (failed.length > 0) {
    console.log(`\n${failed.length} package(s) failed validation.`);
  } else {
    console.log('\nAll packages passed validation.');
  }
}
