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

program.addCommand(calcHspCommand());
program.addCommand(exportRabCommand());
program.addCommand(validateCommand());

program.parse(process.argv);
