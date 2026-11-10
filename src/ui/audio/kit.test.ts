import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  homeTonic,
  INSTRUMENTS,
  isNote,
  kitFiles,
  ladderSemitones,
  LADDER_TOP_STEP,
  noteMidi,
  pick,
  RECIPES,
  roundRobin,
  scaleSemitones,
  SETS,
  snapToPentatonic,
  type Instrument,
  type Key,
} from './kit.ts';
import { audioIds } from './loader.ts';

const KEYS: Key[] = Array.from({ length: 12 }, (_, root) => [
  { root, mode: 'major' as const },
  { root, mode: 'minor' as const },
]).flat();
const PENT = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10] };
const inPentatonic = (key: Key, midi: number) =>
  PENT[key.mode].includes((((midi - key.root) % 12) + 12) % 12);

describe('the recorded sound set', () => {
  it('uses only files the build has, each cut in art/audio.json', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'art/audio.json'), 'utf8')) as {
      cuts: Record<string, unknown>;
    };
    const built = new Set(audioIds());
    for (const file of kitFiles()) {
      expect(built.has(file), `${file} isn't in assets/audio/ as .ogg and .m4a`).toBe(true);
      expect(manifest.cuts, `${file} isn't in art/audio.json`).toHaveProperty([file]);
    }
  });

  it('plays every note of every recipe within half an octave of a sample, in any key', () => {
    for (const key of KEYS) {
      for (const [id, recipe] of Object.entries(RECIPES)) {
        for (const layer of recipe!.layers) {
          if (!isNote(layer)) continue;
          for (const shift of [0, -2, 2, 5]) {
            const { rate } = pick(layer.inst, noteMidi(key, layer, shift));
            const semitones = Math.abs(12 * Math.log2(rate));
            expect(semitones, `${id} in ${key.root} ${key.mode}`).toBeLessThanOrEqual(6.5);
          }
        }
      }
    }
  });

  it('puts every note in the key, and a moved one on its pentatonic scale', () => {
    for (const key of KEYS) {
      const scale = new Set([0, 1, 2, 3, 4, 5, 6].map((s) => scaleSemitones(key, s)));
      for (const recipe of Object.values(RECIPES)) {
        for (const layer of recipe!.layers) {
          if (!isNote(layer)) continue;
          const midi = noteMidi(key, layer);
          expect(scale.has((((midi - key.root) % 12) + 12) % 12)).toBe(true);
          for (const shift of [0.4, 1.65, -3.2, 4.1]) {
            expect(inPentatonic(key, noteMidi(key, layer, shift))).toBe(true);
          }
        }
      }
    }
  });

  it('lands each tonic in its instrument’s register', () => {
    for (const inst of Object.keys(INSTRUMENTS) as Instrument[]) {
      for (const key of KEYS) {
        const tonic = homeTonic(key, inst);
        expect(tonic - INSTRUMENTS[inst].home).toBeGreaterThanOrEqual(0);
        expect(tonic - INSTRUMENTS[inst].home).toBeLessThan(12);
        expect(((tonic % 12) + 12) % 12).toBe(key.root);
      }
    }
  });

  it('snaps to the nearest note of the pentatonic scale', () => {
    const c: Key = { root: 0, mode: 'major' };
    expect(snapToPentatonic(c, 60)).toBe(60);
    expect(snapToPentatonic(c, 61.2)).toBe(62);
    expect(snapToPentatonic(c, 65.4)).toBe(64);
    expect(snapToPentatonic(c, 65.6)).toBe(67);
    const a: Key = { root: 9, mode: 'minor' };
    for (let m = 50; m < 90; m += 0.37) expect(inPentatonic(a, snapToPentatonic(a, m))).toBe(true);
  });

  // §12, Sound: "a reserved bell or gong ... never used for anything else" (D-058).
  it('keeps the bell and the gong for ×Mult', () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      if (id === 'stamp') continue;
      for (const layer of recipe!.layers) {
        expect(isNote(layer) ? layer.inst : layer.set, id).not.toBe('bell');
        expect(isNote(layer) ? layer.inst : layer.set, id).not.toBe('gong');
      }
    }
  });

  it('round-robins without playing a file twice in a row', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const next = roundRobin(random);
    for (const set of ['thock', 'fwp', 'chip', 'click'] as const) {
      let last = '';
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) {
        const file = next(set);
        expect(file).not.toBe(last);
        expect(SETS[set]).toContain(file);
        seen.add(file);
        last = file;
      }
      expect(seen.size).toBe(SETS[set].length);
    }
  });
});

describe('the ladder', () => {
  it('climbs the pentatonic scale two octaves, then holds', () => {
    for (const key of KEYS) {
      let previous = -1;
      for (let step = 0; step <= LADDER_TOP_STEP + 3; step++) {
        const s = ladderSemitones(step, key);
        expect(PENT[key.mode]).toContain(s % 12);
        expect(s).toBeGreaterThanOrEqual(previous);
        previous = s;
      }
      expect(ladderSemitones(0, key)).toBe(0);
      expect(ladderSemitones(LADDER_TOP_STEP, key)).toBe(24);
      expect(ladderSemitones(Number.NaN, key)).toBe(0);
    }
  });

  it('starts each week on the music’s tonic, on the marimba', () => {
    for (const key of KEYS) {
      for (let step = 0; step <= LADDER_TOP_STEP; step++) {
        const midi = homeTonic(key, 'marimba') + ladderSemitones(step, key);
        expect(inPentatonic(key, midi)).toBe(true);
        const { rate } = pick('marimba', midi);
        expect(Math.abs(12 * Math.log2(rate))).toBeLessThanOrEqual(6);
      }
    }
  });
});
