/**
 * Binary min-heap (priority queue), written by hand.
 *
 * Stores integer ids with two keys: f (main key) and g (tie-breaker).
 * On equal f we pop the node with LARGER g first – it is closer to the goal,
 * which makes A* reach the goal with fewer expansions.
 *
 * push: O(log n)    pop: O(log n)    size: O(1)
 */
export class MinHeap {
  constructor() {
    this.ids = [];
    this.f = [];
    this.g = [];
  }

  get size() { return this.ids.length; }

  clear() {
    this.ids.length = 0;
    this.f.length = 0;
    this.g.length = 0;
  }

  // true if element i should be above element j
  less(i, j) {
    if (this.f[i] !== this.f[j]) return this.f[i] < this.f[j];
    return this.g[i] > this.g[j];
  }

  swap(i, j) {
    const { ids, f, g } = this;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    [f[i], f[j]] = [f[j], f[i]];
    [g[i], g[j]] = [g[j], g[i]];
  }

  push(id, fVal, gVal) {
    this.ids.push(id);
    this.f.push(fVal);
    this.g.push(gVal);
    let i = this.ids.length - 1;
    while (i > 0) {                       // sift up
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  /** Removes and returns the id with the smallest f (undefined if empty). */
  pop() {
    const n = this.ids.length;
    if (n === 0) return undefined;
    const top = this.ids[0];
    this.swap(0, n - 1);
    this.ids.pop();
    this.f.pop();
    this.g.pop();
    let i = 0;
    const size = n - 1;
    while (true) {                        // sift down
      const l = 2 * i + 1;
      const r = l + 1;
      let best = i;
      if (l < size && this.less(l, best)) best = l;
      if (r < size && this.less(r, best)) best = r;
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
    return top;
  }
}
