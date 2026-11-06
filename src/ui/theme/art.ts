// The interface's own pixel art (M5a): the 9-slice frames, small parts (a ribbon's tails, a
// tooltip's tail), the icons, and the title's sky (scenery.ts), drawn for Open House in
// LimeZu's palette as text grids, one character per pixel ('.' is transparent). They're our
// own work, so they carry none of the packs' license questions (D-097's license note).
//
// At startup, applyArt() draws each grid into a small canvas and publishes it as a CSS custom
// property, `--art-<name>: url(data:…)`. Frames are applied with border-image, the rest as
// backgrounds, at whole multiples of the UI pixel (--px; the sky at the title street's scale)
// with image-rendering: pixelated, so every art pixel lands on whole device pixels. Nothing is
// fetched, and nothing changes after startup.

import { FRAMES, PARTS, PATTERNS } from './frames.ts';
import { ICONS } from './icons.ts';
import { SCENERY } from './scenery.ts';

/** LimeZu's colors (its Modern Interiors and Modern Exteriors palettes), one character each. */
export const UI_PALETTE: Readonly<Record<string, string>> = {
  // Inks and greys.
  k: '#3a3a50', // ink: LimeZu's outline
  K: '#46465e',
  s: '#565972', // ink-soft
  f: '#6c6e85', // ink-faint
  g: '#8b8bab',
  G: '#b2aecb',
  L: '#d8d0e0',
  w: '#f8f8f8',
  W: '#fefcfe', // card-hi
  // Paper.
  p: '#f4efdf', // paper
  P: '#fbf8ef', // card
  i: '#eee1b7', // paper-inset
  I: '#e0d0b2', // card-lo
  // Wood.
  H: '#f1ce8e', // wood-shine
  h: '#e0b870', // wood-hi
  l: '#daa463', // wood-light
  o: '#c78c59', // wood
  m: '#b5754d', // wood-mid
  d: '#a85f46', // wood-dark
  e: '#6b5052', // wood-deep
  // Gold and orange.
  u: '#fff59a',
  y: '#f8d239', // sparkle
  Y: '#f2b22b', // sparkle-deep
  n: '#ed931e', // bad-fill
  N: '#a8480c', // bad
  O: '#66451e',
  // Blues.
  c: '#c4d7e3', // comfort-tint
  C: '#95e3e3',
  B: '#4995e3',
  b: '#3d56d2', // comfort
  j: '#1652b9', // good
  // Roses.
  R: '#f8c7cf', // charm-tint
  q: '#e88dad',
  Q: '#d6779d',
  r: '#a82b52', // charm
  // Greens.
  A: '#b8d040', // action-hi
  a: '#9bc246', // action
  v: '#64b63b',
  V: '#568d61', // action-shade
  t: '#455c5b',
  // Reds, purples, browns.
  x: '#e63f38',
  X: '#a82b2d',
  z: '#887ca4',
  Z: '#54467f',
  T: '#b2977e',
  M: '#7e6151',
};

/** A grid's rows, from a template literal: blank lines dropped, indentation trimmed. */
export function gridRows(src: string): string[] {
  return src
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** What's wrong with a grid, if anything: ragged rows, or characters outside the palette. */
export function gridProblems(name: string, rows: readonly string[]): string[] {
  const problems: string[] = [];
  if (rows.length === 0) return [`${name}: empty`];
  const w = rows[0]!.length;
  rows.forEach((row, y) => {
    if (row.length !== w) problems.push(`${name}: row ${y} is ${row.length} wide, not ${w}`);
    for (const [x, ch] of [...row].entries()) {
      if (ch !== '.' && !(ch in UI_PALETTE)) problems.push(`${name}: '${ch}' at ${x},${y}`);
    }
  });
  return problems;
}

export function gridSize(rows: readonly string[]): { w: number; h: number } {
  return { w: rows[0]?.length ?? 0, h: rows.length };
}

function rgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) : 255;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

/** A grid as a PNG data URL, one image pixel per art pixel (browser only). */
export function gridDataUrl(rows: readonly string[]): string {
  const { w, h } = gridSize(rows);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(w, h);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const hex = UI_PALETTE[ch];
      if (hex) image.data.set(rgba(hex), (y * w + x) * 4);
    });
  });
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export type IconName = keyof typeof ICONS;
export type FrameName = keyof typeof FRAMES;
export type SceneryName = keyof typeof SCENERY;

/** Each icon's size in art px (one --px each), for its box. */
export const ICON_SIZES = Object.fromEntries(
  Object.entries(ICONS).map(([name, grid]) => [name, gridSize(gridRows(grid))]),
) as Record<IconName, { w: number; h: number }>;

/** Each scenery piece's size in art px, for its box. */
export const SCENERY_SIZES = Object.fromEntries(
  Object.entries(SCENERY).map(([name, grid]) => [name, gridSize(gridRows(grid))]),
) as Record<SceneryName, { w: number; h: number }>;

/**
 * Publishes every frame, pattern, part, icon and scenery piece as a CSS custom property on the
 * page: `--art-<frame>`, `--art-<pattern>`, `--art-<part>`, `--art-icon-<icon>`,
 * `--art-scene-<piece>`. Runs once, at startup.
 */
export function applyArt(): void {
  const style = document.documentElement.style;
  const publish = (name: string, grid: string) =>
    style.setProperty(`--art-${name}`, `url("${gridDataUrl(gridRows(grid))}")`);
  for (const [name, frame] of Object.entries(FRAMES)) publish(name, frame.grid);
  for (const [name, grid] of Object.entries(PATTERNS)) publish(name, grid);
  for (const [name, grid] of Object.entries(PARTS)) publish(name, grid);
  for (const [name, grid] of Object.entries(ICONS)) publish(`icon-${name}`, grid);
  for (const [name, grid] of Object.entries(SCENERY)) publish(`scene-${name}`, grid);
}
