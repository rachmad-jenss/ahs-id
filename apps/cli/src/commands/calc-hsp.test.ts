import { describe, expect, it } from 'vitest';
import { formatTerminalComponentLines, formatTerminalContinuation, getTerminalLayout, wrapTerminalText } from './calc-hsp.js';

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

  it('uses a stacked component layout when a terminal cannot fit the table columns', () => {
    const layout = getTerminalLayout(60);
    const lines = formatTerminalComponentLines({
      nama: 'Excavator dengan deskripsi yang panjang',
      ref: 'E.01',
      satuan: 'jam',
      coefficient: 0.0081,
      unit_price: 1234567890,
      total_price: 9999999999,
    }, layout);

    expect(layout.compact).toBe(true);
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(60);
  });
});
