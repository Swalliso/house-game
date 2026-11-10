// Stored settings (§12): only valid values are kept, so a bad one falls back to its default.

import { describe, expect, it } from 'vitest';
import { defaultSettings, parseStored } from './settings.ts';

describe('stored settings', () => {
  it('keep the readable-font choice, and only a true or false one', () => {
    expect(parseStored({ readableFont: true })).toEqual({ readableFont: true });
    expect(parseStored({ readableFont: false })).toEqual({ readableFont: false });
    expect(parseStored({ readableFont: 'yes' })).toEqual({});
    expect(parseStored({ readableFont: 1 })).toEqual({});
  });

  it('keep a known tally speed and Reduce motion, and clamp the sliders', () => {
    const d = defaultSettings();
    expect(parseStored({ tallySpeed: 2, reduceMotion: true }, d)).toEqual({
      tallySpeed: 2,
      reduceMotion: true,
    });
    expect(parseStored({ tallySpeed: 7 }, d)).toEqual({});
    expect(parseStored({ shake: 140, masterVolume: -5, sfxVolume: 33.6 }, d)).toEqual({
      shake: 100,
      masterVolume: 0,
      sfxVolume: 34,
    });
    expect(parseStored({ shake: 'loud' }, d)).toEqual({ shake: d.shake });
  });

  it('keep Flashing, on by default (D-125)', () => {
    const d = defaultSettings();
    expect(d.flashing).toBe(true);
    expect(parseStored({ flashing: false }, d)).toEqual({ flashing: false });
    expect(parseStored({ flashing: 'no' }, d)).toEqual({});
  });

  it('ignore anything that is not a settings object', () => {
    for (const raw of [null, undefined, 3, 'text', [true]]) expect(parseStored(raw)).toEqual({});
  });
});
