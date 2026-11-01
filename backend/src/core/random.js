/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Same seed => same robots, same orders => every algorithm is tested
 * on exactly the same input, so the comparison is fair and repeatable.
 */
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // [0, 1)
  };
  return {
    next,
    int: (n) => Math.floor(next() * n), // integer in [0, n)
    /** Fisher–Yates shuffle, O(n) */
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}
