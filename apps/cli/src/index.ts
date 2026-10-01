#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { calcHspCommand } from './commands/calc-hsp.js';
import { exportRabCommand } from './commands/export-rab.js';
import { validateCommand } from './commands/validate.js';

const program = new Command();

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { version: string };

program
  .name('ahs-id')
  .description('AHSP calculation, RAB export, and bundle validation CLI')
  .version(pkg.version);

const outputConfiguration = { outputError: (): void => undefined };
const commands = [calcHspCommand(), exportRabCommand(), validateCommand()];
for (const command of commands) {
  command.configureOutput(outputConfiguration);
  command.exitOverride();
  program.addCommand(command);
}
program.configureOutput(outputConfiguration);
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const exitCode = getCommanderExitCode(error);
  if (exitCode !== 0) {
    const message = error instanceof Error ? error.message : String(error);
    const json = process.argv.includes('--json');
    console.error(json ? JSON.stringify({ error: message }) : message);
  }
  process.exitCode = exitCode;
}

function getCommanderExitCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'exitCode' in error && typeof error.exitCode === 'number') {
    return error.exitCode;
  }
  return 1;
}
