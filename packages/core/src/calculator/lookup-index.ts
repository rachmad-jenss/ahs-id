/** First matching entry wins, matching `Array.find`. */
export function firstByKey<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return map;
}
