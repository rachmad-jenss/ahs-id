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
  command.showHelpAfterError(false).showSuggestionAfterError(false);
  command.exitOverride();
  program.addCommand(command);
}
program.configureOutput(outputConfiguration);
program.showHelpAfterError(false).showSuggestionAfterError(false);
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  const exitCode = getCommanderExitCode(error);
  if (exitCode !== 0 && !commanderAlreadyPrintedOutput(error)) {
    const message = error instanceof Error ? error.message : String(error);
    const json = process.argv.includes('--json');
    console.error(json ? JSON.stringify({ error: message }) : message);
  }
  process.exitCode = exitCode;
}

/** Extract a Commander exit code without weakening the unknown error type. */
function getCommanderExitCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'exitCode' in error && typeof error.exitCode === 'number') {
    return error.exitCode;
  }
  return 1;
}

/** Avoid duplicating help or version output that Commander already emitted. */
function commanderAlreadyPrintedOutput(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error) || typeof error.code !== 'string') {
    return false;
  }

  return ['commander.help', 'commander.helpDisplayed', 'commander.version'].includes(error.code);
}
