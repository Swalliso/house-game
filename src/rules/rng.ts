// Seeded randomness (implementation-plan.md §6, D-039).
//
// The rules never store a generator. Each random decision derives a fresh stream from the run
// seed and a key (`lot/<attempt>`, `draw/<phase>/<slot>/<n>`, …), so a reroll or an extra week
// never shifts any later hand. sfc32 (128-bit state; add, shift, and xor only), seeded through
// splitmix32 from an FNV-1a hash of the seed and key, with the first 12 outputs discarded.
// Math.imul, `| 0`, and `>>> 0` keep results identical in every browser and in Node.

export interface Rng {
  /** A uniform 32-bit unsigned integer. */
  u32(): number;
  /** A uniform integer in [0, n). */
  int(n: number): number;
  /** A uniform integer in [min, max], inclusive. */
  range(min: number, max: number): number;
  /** True with probability pct / 100. */
  chance(pct: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/** FNV-1a over UTF-16 code units. Also used for content hashes. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
}

const TWO_32 = 4294967296;

/** A fresh stream for one random decision. The same seed and key always give the same numbers. */
export function stream(seed: string, key: string): Rng {
  const mix = splitmix32(fnv1a(`${seed}\u0000${key}`));
  const next = sfc32(mix(), mix(), mix(), mix());
  for (let i = 0; i < 12; i++) next();

  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0)
      throw new Error(`rng.int needs a positive integer, got ${n}`);
    // u32 / 2^32 is exact, so this is the same in every engine.
    return Math.floor((next() / TWO_32) * n);
  };
  return {
    u32: next,
    int,
    range: (min, max) => min + int(max - min + 1),
    chance: (pct) => int(100) < pct,
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick from an empty list');
      return items[int(items.length)]!;
    },
  };
}
