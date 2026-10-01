import { describe, expect, it } from 'vitest';
import { formatTerminalContinuation, getTerminalLayout, wrapTerminalText } from './calc-hsp.js';

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

  it('shrinks the description column for narrow terminals without dropping below readability', () => {
    expect(getTerminalLayout(80).descriptionWidth).toBe(28);
    expect(getTerminalLayout(60).descriptionWidth).toBe(20);
    expect(getTerminalLayout(120).descriptionWidth).toBe(38);
  });
});
