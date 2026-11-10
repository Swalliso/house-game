// D-122: which of a play's causes the board names, on playtest 4's plays from the legibility
// deep-dive (their parts as the rules would split them).

import { describe, expect, it } from 'vitest';
import type { WowPart } from '../../rules/index.ts';
import { causeSuffix, hiddenPart, mainCause, partLine } from './causes.ts';

const part = (kind: WowPart['kind'], label: string, wow: number): WowPart => ({ kind, label, wow });

describe('the cause the board names (D-122)', () => {
  it("the Closet's +139 names the Suite it completes, not the Closet's own +10", () => {
    const p = {
      delta: 139,
      parts: [
        part('set', 'Suite', 134),
        part('piece', 'Closet', 10),
        part('neighbor', 'Bedroom earns less', -5),
      ],
    };
    expect(mainCause(p)?.label).toBe('Suite');
    expect(causeSuffix(p)).toBe(' · Suite');
    // A −5 behind +139 isn't worth a line.
    expect(hiddenPart(p)).toBeNull();
  });

  it("the Garage's −48 names Cozy turning off", () => {
    const p = {
      delta: -48,
      parts: [
        part('spec', 'Cozy off', -31),
        part('neighbor', 'Living Room earns less', -28),
        part('piece', 'Garage', 11),
      ],
    };
    expect(causeSuffix(p)).toBe(' · Cozy off');
    expect(hiddenPart(p)).toBeNull();
  });

  it("a Living Room's +45 that hides Cozy's −68 gets a second line", () => {
    const p = {
      delta: 45,
      parts: [
        part('piece', 'Living Room', 80),
        part('spec', 'Cozy off', -68),
        part('set', 'Entertainer', 33),
      ],
    };
    // Its own +80 is the card's to explain; the Entertainer is a real share of the +45.
    expect(causeSuffix(p)).toBe(' · Entertainer');
    const hidden = hiddenPart(p)!;
    expect(partLine(hidden)).toBe('▼ −68 Wow · Cozy off');
  });

  it('a change of 0 names the gain that pays for the loss under it', () => {
    const p = {
      delta: 0,
      parts: [part('spec', 'Room for everyone', 83), part('spec', 'Cozy off', -83)],
    };
    expect(causeSuffix(p)).toBe(' · Room for everyone');
    expect(partLine(hiddenPart(p)!)).toBe('▼ −83 Wow · Cozy off');
  });

  it('never names rounding ("Other changes")', () => {
    const p = { delta: 3, parts: [part('other', 'Other changes', 2), part('piece', 'Garage', 1)] };
    expect(mainCause(p)).toBeNull();
    expect(hiddenPart({ delta: 30, parts: [part('other', 'Other changes', -12)] })).toBeNull();
  });

  it('names nothing when the card explains it, or the change is nothing', () => {
    expect(
      causeSuffix({
        delta: 12,
        parts: [part('piece', 'Bedroom', 11), part('neighbor', 'Bathroom earns more', 1)],
      }),
    ).toBe('');
    expect(causeSuffix({ delta: 0, parts: [] })).toBe('');
  });
});
