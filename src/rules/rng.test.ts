import { describe, expect, it } from 'vitest';
import { fnv1a, stream } from './rng.ts';

describe('keyed streams', () => {
  it('give the same numbers for the same seed and key', () => {
    const a = stream('seed', 'draw/0/1/0');
    const b = stream('seed', 'draw/0/1/0');
    const xs = Array.from({ length: 20 }, () => a.u32());
    expect(Array.from({ length: 20 }, () => b.u32())).toEqual(xs);
  });

  it('give different numbers for a different key or seed', () => {
    const first = (seed: string, key: string) => stream(seed, key).u32();
    expect(first('seed', 'draw/0/1/0')).not.toBe(first('seed', 'draw/0/1/1'));
    expect(first('seed', 'draw/0/1/0')).not.toBe(first('seed2', 'draw/0/1/0'));
    // The seed and key are separated, so "a" + "b/c" isn't "a/b" + "c".
    expect(first('a', 'b/c')).not.toBe(first('a/b', 'c'));
  });

  it('are pinned: these numbers must never change, or old run codes stop replaying', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    const r = stream('open-house', 'lot/0');
    expect([r.u32(), r.u32(), r.u32()]).toMatchInlineSnapshot(`
      [
        3713351699,
        816736518,
        4283896466,
      ]
    `);
  });

  it('stay in range and cover it', () => {
    const r = stream('range', 'x');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.range(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('are roughly uniform', () => {
    const r = stream('uniform', 'x');
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) counts[r.int(10)]++;
    for (const c of counts) expect(c).toBeGreaterThan(1800);
  });

  it('reject bad bounds', () => {
    const r = stream('bad', 'x');
    expect(() => r.int(0)).toThrow();
    expect(() => r.int(1.5)).toThrow();
    expect(() => r.pick([])).toThrow();
  });
});
