import { Command } from 'commander';
import { calcHspCommand } from './commands/calc-hsp.js';
import { exportRabCommand } from './commands/export-rab.js';
import { validateCommand } from './commands/validate.js';

const program = new Command();

program
  .name('ahs-id')
  .description('AHSP calculation, RAB export, and bundle validation CLI')
  .version('0.0.1');

program.addCommand(calcHspCommand());
program.addCommand(exportRabCommand());
program.addCommand(validateCommand());

program.parse(process.argv);
