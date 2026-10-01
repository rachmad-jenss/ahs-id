import { describe, expect, it } from 'vitest';
import { formatTerminalContinuation, wrapTerminalText } from './calc-hsp.js';

describe('wrapTerminalText', () => {
  it('wraps long component descriptions without exceeding the requested width', () => {
    expect(wrapTerminalText('Excavator sangat panjang', 12)).toEqual([
      'Excavator',
      'sangat',
      'panjang',
    ]);
  });

  it('marks wrapped continuation lines as part of the current component', () => {
    expect(formatTerminalContinuation('sangat panjang')).toBe('  ↳ sangat panjang');
  });
});
