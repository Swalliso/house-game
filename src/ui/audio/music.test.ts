import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audioIds } from './loader.ts';
import { shuffled, stemLevels } from './music.ts';
import { sceneFor } from './scene.ts';
import { SCENE_MIX, SCENES, TRACKS, type Track } from './tracks.ts';

const track = (id: string, stems = 1, mix?: Track['mix']): Track => ({
  id,
  title: id,
  author: 'test',
  key: { root: 0, mode: 'major' },
  bpm: 80,
  stems: Array.from({ length: stems }, (_, i) => `music/${id}/s${i}`),
  mix,
});

describe('the tracks', () => {
  it('have their stems in the build, cut in art/audio.json, and a key', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'art/audio.json'), 'utf8')) as {
      cuts: Record<string, unknown>;
    };
    const built = new Set(audioIds());
    const index = JSON.parse(
      readFileSync(join(process.cwd(), 'assets/audio/index.json'), 'utf8'),
    ) as Record<string, { seconds: number }>;
    for (const t of TRACKS) {
      expect(t.stems.length, t.id).toBeGreaterThan(0);
      expect(Number.isInteger(t.key.root) && t.key.root >= 0 && t.key.root < 12, t.id).toBe(true);
      const lengths = new Set<number>();
      for (const stem of t.stems) {
        expect(built.has(stem), `${stem} isn't in assets/audio/`).toBe(true);
        expect(manifest.cuts, `${stem} isn't in art/audio.json`).toHaveProperty([stem]);
        lengths.add(Math.round(index[stem]!.seconds * 10));
      }
      // Synced stems: the same length, so they end together (§12, Synced stems).
      expect(lengths.size, `${t.id}'s stems differ in length`).toBe(1);
      for (const [scene, levels] of Object.entries(t.mix ?? {})) {
        expect(levels!.length, `${t.id}'s ${scene} mix`).toBe(t.stems.length);
      }
      // A screen without a mix plays every stem at once, which doubles alternate mixes (D-128's
      // Sleepy Little Mouse), so a track with stems names every screen's mix.
      if (t.stems.length > 1) {
        for (const scene of SCENES) expect(t.mix?.[scene], `${t.id} on ${scene}`).toBeDefined();
      }
    }
  });

  it('mixes every screen', () => {
    for (const scene of SCENES) {
      expect(SCENE_MIX[scene].level).toBeGreaterThan(0);
      expect(SCENE_MIX[scene].level).toBeLessThanOrEqual(1);
      expect(SCENE_MIX[scene].cutoff).toBeGreaterThan(200);
    }
  });
});

describe('the player', () => {
  it('shuffles every track once, never repeating the last one first', () => {
    const all = ['a', 'b', 'c'].map((id) => track(id));
    let seed = 3;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 30; i++) {
      const previous = all[i % 3]!;
      const order = shuffled(all, previous, random);
      expect(new Set(order.map((t) => t.id))).toEqual(new Set(['a', 'b', 'c']));
      expect(order[0]).not.toBe(previous);
    }
    expect(shuffled([all[0]!], all[0]!, random)).toEqual([all[0]]);
    expect(shuffled([], null, random)).toEqual([]);
  });

  it('plays a screen’s stems at its mix, and every stem elsewhere', () => {
    const t = track('t', 3, { shop: [1, 0.5, 0], crate: [0, 0, 1] });
    expect(stemLevels(t, 'shop')).toEqual([1, 0.5, 0]);
    expect(stemLevels(t, 'crate')).toEqual([0, 0, 1]);
    expect(stemLevels(t, 'build')).toEqual([1, 1, 1]);
    expect(stemLevels(track('one'), 'shop')).toEqual([1]);
  });
});

describe('the music’s screens', () => {
  it('follow what the player sees', () => {
    expect(sceneFor('title', 'build', false, false)).toBe('title');
    expect(sceneFor('jobs', 'build', false, false)).toBe('menu');
    expect(sceneFor('game', 'build', false, false)).toBe('build');
    // A normal week's tally stays on the build mix.
    expect(sceneFor('game', 'build', false, true)).toBe('build');
    expect(sceneFor('game', 'shop', false, false)).toBe('shop');
    expect(sceneFor('game', 'shop', true, false)).toBe('crate');
    expect(sceneFor('game', 'changeOrder', false, false)).toBe('review');
    // The rules are in the shop (or over) while the milestone's beats still play.
    expect(sceneFor('game', 'shop', false, true)).toBe('review');
    expect(sceneFor('game', 'won', false, true)).toBe('review');
    expect(sceneFor('game', 'lost', false, true)).toBe('review');
    expect(sceneFor('game', 'won', false, false)).toBe('won');
    expect(sceneFor('game', 'lost', false, false)).toBe('lost');
  });
});
