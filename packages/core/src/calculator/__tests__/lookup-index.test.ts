import { describe, expect, it } from 'vitest';
import { firstByKey } from '../lookup-index.js';

describe('firstByKey', () => {
  it('keeps the first entry for a repeated key', () => {
    const map = firstByKey(
      [{ id: 'a', n: 1 }, { id: 'a', n: 2 }, { id: 'b', n: 3 }],
      (item) => item.id,
    );
    expect(map.get('a')?.n).toBe(1);
    expect(map.get('b')?.n).toBe(3);
  });
});
