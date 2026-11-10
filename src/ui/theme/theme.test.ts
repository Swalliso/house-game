// The interface's look (M5a): the tokens are the one place colors live and their text pairs
// read at 4.5:1, the pixel art's grids are well formed, and the UI pixel lands on whole device
// pixels.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../rules/index.ts';
import { isLimeZuColor } from '../art/palette.ts';
import { gridProblems, gridRows, gridSize, ICON_SIZES, UI_PALETTE } from './art.ts';
import { FRAMES, PARTS, PATTERNS } from './frames.ts';
import { ICONS } from './icons.ts';
import { SCENERY } from './scenery.ts';
import { pictureScale, thumbScale, uiPixel, uiPixelDevice } from './pixel.ts';

const UI = join(import.meta.dirname, '..');
const TOKENS = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

/**
 * Stylesheets that still hold raw colors, until a pass on app.css's last board rules (the pieces'
 * digits, the popups) and on the ?debug panel moves them to tokens. Each one that's migrated comes
 * off this list, and the test keeps it off.
 */
const LEGACY = ['app.css', 'debug/debug.css'];

function stylesheets(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return name.endsWith('.css') ? [relative(UI, path)] : [];
  });
}

/** Every custom property on the tokens' :root, with var() references resolved. */
function tokens(): Map<string, string> {
  const root = TOKENS.slice(TOKENS.indexOf(':root {'), TOKENS.indexOf("[data-font='readable']"));
  const raw = new Map([...root.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!]));
  const resolve = (v: string): string => {
    const ref = /^var\(--([\w-]+)\)$/.exec(v.trim());
    return ref ? resolve(raw.get(ref[1]!) ?? '') : v.trim();
  };
  return new Map([...raw].map(([k, v]) => [k, resolve(v)]));
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * A wash (a token in `rgb(r g b / a)`) laid over an opaque color, blended to whole 8-bit values
 * as the browser draws it, so text on it can be checked. Undefined for anything else.
 */
function over(wash: string | undefined, base: string | undefined): string | undefined {
  const m = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(wash ?? '');
  if (!m || !base?.startsWith('#')) return undefined;
  const alpha = Number(m[4]);
  const n = parseInt(base.slice(1, 7), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, k) =>
    Math.round(alpha * Number(m[k + 1]) + (1 - alpha) * v),
  );
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('the tokens', () => {
  it('are the only stylesheet with raw colors, apart from the legacy ones', () => {
    const sheets = stylesheets(UI);
    for (const legacy of LEGACY)
      expect(sheets, `${legacy} is gone: drop it from LEGACY`).toContain(legacy);
    const raw = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]/i;
    const offenders = sheets
      .filter((s) => s !== 'theme/tokens.css' && !LEGACY.includes(s))
      .flatMap((s) =>
        readFileSync(join(UI, s), 'utf8')
          .split('\n')
          .flatMap((line, i) => (raw.test(line) ? [`${s}:${i + 1}: ${line.trim()}`] : [])),
      );
    expect(offenders).toEqual([]);
  });

  it('read at 4.5:1 or better, for each text color on the backgrounds it sits on', () => {
    const t = tokens();
    // [text, background]: every pairing the interface uses for text. A translucent background
    // (a wash) names the one it lies on third.
    const pairs: (readonly [text: string, bg: string, under?: string])[] = [
      ['ink', 'paper'],
      ['ink', 'card'],
      ['ink', 'card-hi'],
      ['ink', 'paper-inset'],
      ['ink-soft', 'paper'],
      ['ink-soft', 'card'],
      ['ink-soft', 'paper-inset'],
      ['comfort', 'paper'],
      ['comfort', 'card'],
      ['comfort', 'comfort-tint'],
      ['charm', 'paper'],
      ['charm', 'card'],
      ['charm-deep', 'charm-tint'],
      ['sparkle-text', 'paper'],
      ['good', 'card'],
      ['good', 'comfort-tint'],
      ['bad', 'card'],
      ['bad', 'bad-tint'],
      ['ink', 'sparkle'],
      ['ink', 'gold-hi'],
      ['ink', 'wood-hi'],
      ['ink', 'wood-light'],
      ['on-wood', 'wood-deep'],
      ['on-wood', 'wood-night'],
      ['ink', 'action'],
      ['on-wood', 'danger'],
      ['ink', 'armed'],
      ['ink', 'armed-hi'],
      ['ink', 'bad-fill'],
      ['rarity-common-text', 'card'],
      ['rarity-uncommon-text', 'card'],
      ['rarity-uncommon-text', 'comfort-tint'],
      ['ink', 'tint-yard'],
      ['ink', 'tint-outbuilding'],
      ['ink', 'tint-hall'],
      ['ink', 'tint-fixture'],
      ['ink', 'dark-fill'],
      // Part 2: the shop's tinted cards and notes, the toast, the leave button's bonus.
      ['ink', 'uncommon-tint'],
      ['ink', 'rare-tint'],
      ['bad', 'paper'],
      ['bad', 'rare-tint'],
      ['ink-soft', 'uncommon-tint'],
      ['on-wood', 'ink'],
      ['ink', 'action-hi'],
      // The board's labels by the pointer (board/labels.css): the demolish label's red.
      ['danger-shade', 'card'],
      // M4 in the pixel UI (D-110). The job board: a Rare contract's quiet text, and the
      // Recommended tab's descenders on its gold lip (screens/jobs.css).
      ['ink-soft', 'rare-tint'],
      ['ink', 'sparkle-deep'],
      // The checklist (hud/checklist.css): a line turning on, on Charm's tint; one turning off,
      // an order a placement would break, and the tally's "lost" flash, on the warning's tint;
      // a folded group's count and Charm, and an order's Met or Kept, on paper and on a hovered
      // fold row.
      ['ink', 'charm-tint'],
      ['ink-soft', 'charm-tint'],
      // The score panel's sets (hud/score.css): a set the placement would make, on Charm's tint.
      ['comfort-deep', 'charm-tint'],
      ['charm-deep', 'charm-tint'],
      ['ink', 'bad-tint'],
      ['ink-soft', 'bad-tint'],
      ['charm', 'bad-tint'],
      ['good', 'paper'],
      ['good', 'paper-inset'],
      ['charm', 'paper-inset'],
      // A fixture's host badges while installing (D-107, board/install-gains.css), and the
      // preview's badges (board/labels.css): paper-colored text on the good and bad fills.
      ['card', 'good'],
      ['card', 'bad'],
      // The score panel's sets folded into one row (D-098's 2026-11-08 change, hud/score.css),
      // lit as the tally counts a set: its name, Comfort and Charm on the board's set
      // highlight, a wash over the panel's paper.
      ['ink', 'hl-lit-fill', 'paper'],
      ['comfort', 'hl-lit-fill', 'paper'],
      ['charm', 'hl-lit-fill', 'paper'],
    ];
    const low = pairs.flatMap(([text, bg, under]) => {
      const name = under ? `${text} on ${bg} over ${under}` : `${text} on ${bg}`;
      const a = t.get(text);
      const b = under ? over(t.get(bg), t.get(under)) : t.get(bg);
      if (!a || !b) return [`${name}: missing`];
      const r = contrast(a, b);
      return r >= 4.5 ? [] : [`${name}: ${r.toFixed(2)}:1`];
    });
    expect(low).toEqual([]);
  });

  it("share the pixel art's palette: the art samples the same colors", () => {
    const t = tokens();
    const palette = new Set(Object.values(UI_PALETTE));
    for (const name of ['ink', 'card-hi', 'wood-hi', 'wood-light', 'wood', 'wood-deep']) {
      expect(palette, name).toContain(t.get(name));
    }
    for (const name of ['comfort', 'charm', 'sparkle', 'sparkle-deep', 'action', 'good']) {
      expect(palette, name).toContain(t.get(name));
    }
    // The orange ribbon's shade, under its tails.
    expect(palette, 'bad-deep').toContain(t.get('bad-deep'));
  });
});

describe('the pixel art', () => {
  const grids: [string, string][] = [
    ...Object.entries(FRAMES).map(([n, f]): [string, string] => [n, f.grid]),
    ...Object.entries(PATTERNS),
    ...Object.entries(PARTS),
    ...Object.entries(ICONS),
    ...Object.entries(SCENERY),
  ];

  it('is drawn in rectangular grids, in the palette', () => {
    expect(grids.flatMap(([name, grid]) => gridProblems(name, gridRows(grid)))).toEqual([]);
  });

  it("uses only LimeZu's colors (D-097: our own drawings sample its palette)", () => {
    const off = Object.entries(UI_PALETTE).filter(([, hex]) => !isLimeZuColor(hex));
    expect(off).toEqual([]);
  });

  it("frames' slices leave a middle", () => {
    for (const [name, frame] of Object.entries(FRAMES)) {
      const { w, h } = gridSize(gridRows(frame.grid));
      const [top, right, bottom, left] = frame.slice;
      expect(top + bottom, name).toBeLessThan(h);
      expect(left + right, name).toBeLessThan(w);
      // The middle is transparent: a frame's fill is its element's background.
      const rows = gridRows(frame.grid);
      for (const row of rows.slice(top, h - bottom)) {
        expect(row.slice(left, w - right), name).toMatch(/^\.+$/);
      }
    }
  });

  it('has an icon for every tag a card can carry', () => {
    const tags = new Set(Object.values(CONTENT.pieces).flatMap((p) => p.tags));
    for (const tag of tags) expect(ICONS, tag).toHaveProperty(tag);
  });

  it('sizes icons from their grids', () => {
    expect(ICON_SIZES.coin).toEqual({ w: 8, h: 8 });
    expect(ICON_SIZES.gear).toEqual({ w: 12, h: 12 });
  });
});

describe('the UI pixel', () => {
  it('is 2 CSS px at 1×, kept on whole device pixels, rounding down on a tie', () => {
    expect([1, 1.25, 1.5, 1.75, 2, 3].map(uiPixelDevice)).toEqual([2, 2, 3, 3, 4, 6]);
    expect(uiPixel(1)).toBe(2);
    expect(uiPixel(1.25)).toBeCloseTo(1.6);
    expect(uiPixel(1.5)).toBe(2);
    expect(uiPixel(2)).toBe(2);
    expect(uiPixelDevice(0.5)).toBe(1);
    expect(uiPixel(Number.NaN)).toBe(2);
  });

  it("puts every art pixel of a card's picture on whole device pixels", () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
      const devicePx = pictureScale(dpr) * dpr;
      expect(devicePx).toBeCloseTo(Math.round(devicePx));
      expect(devicePx).toBeGreaterThanOrEqual(1);
    }
    expect(pictureScale(1)).toBe(1);
    expect(pictureScale(2)).toBe(1);
  });

  it('halves a narrow card’s thumbnail only where the device pixels allow it (D-121)', () => {
    for (const dpr of [1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
      const devicePx = thumbScale(dpr) * dpr;
      expect(devicePx).toBeCloseTo(Math.round(devicePx));
      expect(devicePx).toBeGreaterThanOrEqual(1);
      expect(thumbScale(dpr)).toBeLessThanOrEqual(pictureScale(dpr));
    }
    expect(thumbScale(1)).toBe(1);
    expect(thumbScale(2)).toBe(0.5);
  });
});
