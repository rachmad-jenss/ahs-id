import { describe, expect, it } from 'vitest';
import { wrapTerminalText } from './calc-hsp.js';

describe('wrapTerminalText', () => {
  it('wraps long component descriptions without exceeding the requested width', () => {
    expect(wrapTerminalText('Excavator sangat panjang', 12)).toEqual([
      'Excavator',
      'sangat',
      'panjang',
    ]);
  });
});
