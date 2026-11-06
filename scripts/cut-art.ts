// Cuts the LimeZu sprites we use out of the packs (D-095; implementation-plan.md §12 Art).
//
// art/limezu/*.json are the manifests: one file per part of the game, so work on the terrain
// and work on the house never edit the same file. Each maps sprite ids (the atlas's ids,
// lowercase words joined by "-") to where the sprite is and how to edit it:
//
//   "floor-library": {
//     "pack": "mi",
//     "file": "1_Interiors/16x16/Room_Builder_subfiles/Room_Builder_Floors_16x16.png",
//     "rect": [144, 208, 16, 16],
//     "frames": { "count": 4, "dx": 16, "dy": 0, "ms": 100 },
//     "ops": [{ "op": "tile", "size": [32, 32] }],
//     "note": "Why this sprite, in a few words."
//   }
//
// - pack: "mi" (Modern Interiors) or "me" (Modern Exteriors). file: the sheet's path in the
//   pack's zip. rect: [x, y, w, h] in that sheet.
// - frames (optional): an animation. Frame k is cut at rect + k × (dx, dy), and shows for ms.
// - ops (optional): edits, in order, applied to each frame. See OPS below: tile, recolor,
//   keyOut, flipX, and compose. Adding one is a parse and an apply function.
// - note (optional): for people. It isn't part of the spec hash.
//
// `npm run art:cut` runs locally only. It reads the zips in art-source/ (gitignored, in the
// main checkout, found through `git rev-parse --git-common-dir`, so it works from a worktree)
// and writes, for the listed sprites only:
// - assets/limezu/<id>.png, an animation's frames side by side
// - assets/limezu/index.json: each cut's frame size, frames, and its manifest entry's hash
// - assets/licenses.json's limezu/ entries: one per cut, plus index.json's
// It removes the cuts no manifest lists. It only reads bytes from the zips: nothing in them is
// extracted or run. `npm run atlas` then packs the cuts with the placeholders; CI uses only
// the committed cuts, and scripts/cut-art.test.ts checks them against the manifests.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SPRITE_ID, type CutIndex, type CutRecord } from './build-atlas.ts';
import { decodePng, encodePng, type RgbaImage } from './png.ts';
import { openZip, type Zip } from './zip.ts';

/** LimeZu's two packs: their zips in art-source/, their pages, and the license records. */
export const PACKS = {
  mi: {
    name: 'Modern Interiors',
    zip: 'moderninteriors-win.zip',
    page: 'https://limezu.itch.io/moderninteriors',
    license: 'LicenseRef-LimeZu-Modern-Interiors',
  },
  me: {
    name: 'Modern Exteriors',
    zip: 'modernexteriors-win.zip',
    page: 'https://limezu.itch.io/modernexteriors',
    license: 'LicenseRef-LimeZu-Modern-Exteriors',
  },
} as const;
export type PackId = keyof typeof PACKS;

/** assets/licenses.json keys that art:cut owns: everything under assets/limezu/. */
export const CUTS_PREFIX = 'limezu/';

export type Point = readonly [x: number, y: number];
export type Size = readonly [w: number, h: number];
export type Rect = readonly [x: number, y: number, w: number, h: number];

/** Repeats the image (a seamless tile) from the top left to fill `size`: 16×16 to a 32×32 cell. */
export interface TileOp {
  readonly op: 'tile';
  readonly size: Size;
}
/** Replaces exact colors ("#rrggbb" to "#rrggbb"), keeping each pixel's alpha. */
export interface RecolorOp {
  readonly op: 'recolor';
  readonly map: Readonly<Record<string, string>>;
}
/** Makes exact colors transparent. */
export interface KeyOutOp {
  readonly op: 'keyOut';
  readonly colors: readonly string[];
}
/** Mirrors the image left to right. */
export interface FlipXOp {
  readonly op: 'flipX';
}
/**
 * A canvas of `size`: the image so far at `at` (default [0, 0]), then each layer pasted over it
 * in order, with alpha. A layer is a rect of the same pack (its own `file`, or the entry's),
 * with its own ops.
 */
export interface ComposeOp {
  readonly op: 'compose';
  readonly size: Size;
  readonly at?: Point;
  readonly layers: readonly Layer[];
}
export interface Layer {
  readonly file?: string;
  readonly rect: Rect;
  readonly at: Point;
  readonly ops?: readonly Op[];
}
export type Op = TileOp | RecolorOp | KeyOutOp | FlipXOp | ComposeOp;

export interface Frames {
  readonly count: number;
  readonly dx: number;
  readonly dy: number;
  readonly ms: number;
}

/** One manifest entry. */
export interface CutSpec {
  readonly pack: PackId;
  readonly file: string;
  readonly rect: Rect;
  readonly frames?: Frames;
  readonly ops?: readonly Op[];
  readonly note?: string;
}

export interface ManifestEntry {
  readonly id: string;
  /** The manifest it came from, e.g. "art/limezu/floors.json". */
  readonly manifest: string;
  readonly spec: CutSpec;
}

/** A cut sprite: its pixels (frames side by side) and one frame's size. */
export interface Cut {
  readonly image: RgbaImage;
  readonly w: number;
  readonly h: number;
  readonly frames: number;
  readonly ms?: number;
}

export interface LicenseRecord {
  readonly source: string;
  readonly author: string;
  readonly license: string;
}

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------------------
// Validating the manifests. Every error names the manifest, the id, and the field.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${where} must be an object`);
  return value;
}

function onlyFields(o: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) {
      throw new Error(`${where} has an unknown field "${key}" (expected ${allowed.join(', ')})`);
    }
  }
}

function integer(value: unknown, where: string, min = -Infinity): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error(
      `${where} must be a whole number${min === -Infinity ? '' : ` of at least ${min}`}`,
    );
  }
  return value;
}

function numbers(value: unknown, length: number, where: string, what: string): unknown[] {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${where} must be ${what}`);
  }
  return value;
}

function point(value: unknown, where: string): Point {
  const [x, y] = numbers(value, 2, where, '[x, y]');
  return [integer(x, `${where}[0]`, 0), integer(y, `${where}[1]`, 0)];
}

function size(value: unknown, where: string): Size {
  const [w, h] = numbers(value, 2, where, '[w, h]');
  return [integer(w, `${where}[0]`, 1), integer(h, `${where}[1]`, 1)];
}

function rect(value: unknown, where: string): Rect {
  const [x, y, w, h] = numbers(value, 4, where, '[x, y, w, h]');
  return [
    integer(x, `${where}[0]`, 0),
    integer(y, `${where}[1]`, 0),
    integer(w, `${where}[2]`, 1),
    integer(h, `${where}[3]`, 1),
  ];
}

function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${where} must be a non-empty string`);
  }
  return value;
}

function color(value: unknown, where: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`${where} must be a color "#rrggbb", got ${JSON.stringify(value)}`);
  }
  return value.toLowerCase();
}

/** A sheet's path inside a zip: relative, forward slashes, no "." or ".." parts, a .png. */
function zipPath(value: unknown, where: string): string {
  const path = text(value, where);
  const parts = path.split('/');
  if (
    path.includes('\\') ||
    parts.some((part) => part === '' || part === '.' || part === '..') ||
    !path.endsWith('.png')
  ) {
    throw new Error(`${where} must be a .png's path in the zip, like "folder/sheet.png"`);
  }
  return path;
}

function parseFrames(value: unknown, where: string): Frames {
  const o = record(value, where);
  onlyFields(o, ['count', 'dx', 'dy', 'ms'], where);
  const frames: Frames = {
    count: integer(o.count, `${where}.count`, 2),
    dx: integer(o.dx, `${where}.dx`),
    dy: integer(o.dy, `${where}.dy`),
    ms: integer(o.ms, `${where}.ms`, 1),
  };
  if (frames.dx === 0 && frames.dy === 0) throw new Error(`${where}: dx and dy can't both be 0`);
  return frames;
}

function parseOps(value: unknown, where: string): Op[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${where} must be a non-empty list of ops`);
  }
  return value.map((raw, i) => {
    const at = `${where}[${i}]`;
    const o = record(raw, at);
    const kind = Object.hasOwn(OPS, String(o.op)) ? OPS[o.op as Op['op']] : undefined;
    if (!kind) {
      throw new Error(
        `${at}: unknown op ${JSON.stringify(o.op)} (one of ${Object.keys(OPS).join(', ')})`,
      );
    }
    return kind.parse(o, at);
  });
}

function parseLayer(value: unknown, where: string): Layer {
  const o = record(value, where);
  onlyFields(o, ['file', 'rect', 'at', 'ops'], where);
  return {
    ...(o.file !== undefined ? { file: zipPath(o.file, `${where}.file`) } : {}),
    rect: rect(o.rect, `${where}.rect`),
    at: point(o.at, `${where}.at`),
    ...(o.ops !== undefined ? { ops: parseOps(o.ops, `${where}.ops`) } : {}),
  };
}

/** Validates one manifest entry. */
export function parseSpec(value: unknown, where: string): CutSpec {
  const o = record(value, where);
  onlyFields(o, ['pack', 'file', 'rect', 'frames', 'ops', 'note'], where);
  if (o.pack !== 'mi' && o.pack !== 'me') {
    throw new Error(`${where}.pack must be "mi" (Modern Interiors) or "me" (Modern Exteriors)`);
  }
  return {
    pack: o.pack,
    file: zipPath(o.file, `${where}.file`),
    rect: rect(o.rect, `${where}.rect`),
    ...(o.frames !== undefined ? { frames: parseFrames(o.frames, `${where}.frames`) } : {}),
    ...(o.ops !== undefined ? { ops: parseOps(o.ops, `${where}.ops`) } : {}),
    ...(o.note !== undefined ? { note: text(o.note, `${where}.note`) } : {}),
  };
}

/** Parses one manifest file: an object of entries by sprite id. */
export function parseManifest(json: string, source: string): Map<string, CutSpec> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error(`${source}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const entries = new Map<string, CutSpec>();
  for (const [id, value] of Object.entries(record(raw, source))) {
    const where = `${source}: "${id}"`;
    if (!SPRITE_ID.test(id)) throw new Error(`${where}: ids are lowercase words joined by "-"`);
    entries.set(id, parseSpec(value, where));
  }
  return entries;
}

/** Reads every art/limezu/*.json, sorted by id. An id may appear in only one manifest. */
export function readManifests(dir: string, label = 'art/limezu'): Map<string, ManifestEntry> {
  const all = new Map<string, ManifestEntry>();
  if (!existsSync(dir)) return all;
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort(byString);
  for (const name of files) {
    const manifest = `${label}/${name}`;
    for (const [id, spec] of parseManifest(readFileSync(join(dir, name), 'utf8'), manifest)) {
      const other = all.get(id);
      if (other) throw new Error(`${manifest}: "${id}" is also in ${other.manifest}`);
      all.set(id, { id, manifest, spec });
    }
  }
  return new Map([...all].sort(([a], [b]) => byString(a, b)));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(byString)
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

/**
 * A short hash of what decides an entry's pixels (everything but the note), recorded in
 * index.json: when it no longer matches the manifest, the cut needs `npm run art:cut`.
 */
export function specHash(spec: CutSpec): string {
  const { note, ...pixels } = spec;
  void note;
  return createHash('sha256')
    .update(JSON.stringify(canonical(pixels)))
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------------------
// Images and ops.

function blank(width: number, height: number): RgbaImage {
  return { width, height, rgba: new Uint8Array(width * height * 4) };
}

/** A rect of a sheet. Fully transparent pixels come out as 0, 0, 0, 0. */
export function crop(sheet: RgbaImage, r: Rect, where: string): RgbaImage {
  const [x, y, w, h] = r;
  if (x + w > sheet.width || y + h > sheet.height) {
    throw new Error(
      `${where}: [${r.join(', ')}] is outside the ${sheet.width}×${sheet.height} sheet`,
    );
  }
  const out = blank(w, h);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * sheet.width + x) * 4;
    out.rgba.set(sheet.rgba.subarray(src, src + w * 4), row * w * 4);
  }
  for (let i = 0; i < out.rgba.length; i += 4)
    if (out.rgba[i + 3] === 0) out.rgba.fill(0, i, i + 4);
  return out;
}

/** Pastes `image` over `canvas` at `at`, with alpha ("source over"). It must fit. */
function paste(canvas: RgbaImage, image: RgbaImage, at: Point, where: string): void {
  const [ax, ay] = at;
  if (ax + image.width > canvas.width || ay + image.height > canvas.height) {
    throw new Error(
      `${where}: a ${image.width}×${image.height} image at [${ax}, ${ay}] doesn't fit the ${canvas.width}×${canvas.height} canvas`,
    );
  }
  const src = image.rgba;
  const dst = canvas.rgba;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const s = (y * image.width + x) * 4;
      const d = ((ay + y) * canvas.width + ax + x) * 4;
      const sa = src[s + 3]!;
      if (sa === 0) continue;
      if (sa === 255 || dst[d + 3] === 0) {
        dst.set(src.subarray(s, s + 4), d);
        continue;
      }
      const a = sa / 255;
      const b = (dst[d + 3]! / 255) * (1 - a);
      const out = a + b;
      for (let c = 0; c < 3; c++)
        dst[d + c] = Math.round((src[s + c]! * a + dst[d + c]! * b) / out);
      dst[d + 3] = Math.round(out * 255);
    }
  }
}

function rgbKey(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

/** What an op can read besides the image it edits: sheets of the entry's pack. */
export interface OpContext {
  /** The sheet a layer reads when it names no file of its own. */
  readonly file: string;
  readonly sheet: (file: string) => RgbaImage;
}

interface OpKind<T extends Op> {
  /** Validates an op's fields; `where` names it in errors. */
  readonly parse: (o: Record<string, unknown>, where: string) => T;
  readonly apply: (image: RgbaImage, op: T, ctx: OpContext, where: string) => RgbaImage;
}

type OpKinds = { readonly [K in Op['op']]: OpKind<Extract<Op, { op: K }>> };

/** The ops a manifest can use. Later stages add more here (a splice, a2ToBlob47). */
export const OPS: OpKinds = {
  tile: {
    parse: (o, where) => {
      onlyFields(o, ['op', 'size'], where);
      return { op: 'tile', size: size(o.size, `${where}.size`) };
    },
    apply: (image, op) => {
      const [w, h] = op.size;
      const out = blank(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const s = ((y % image.height) * image.width + (x % image.width)) * 4;
          out.rgba.set(image.rgba.subarray(s, s + 4), (y * w + x) * 4);
        }
      }
      return out;
    },
  },
  recolor: {
    parse: (o, where) => {
      onlyFields(o, ['op', 'map'], where);
      const raw = record(o.map, `${where}.map`);
      const map: Record<string, string> = {};
      for (const [from, to] of Object.entries(raw)) {
        const key = color(from, `${where}.map key`);
        if (Object.hasOwn(map, key)) throw new Error(`${where}.map has ${key} twice`);
        map[key] = color(to, `${where}.map["${from}"]`);
      }
      if (Object.keys(map).length === 0) throw new Error(`${where}.map is empty`);
      return { op: 'recolor', map };
    },
    apply: (image, op) => {
      const map = new Map(Object.entries(op.map).map(([from, to]) => [rgbKey(from), rgbKey(to)]));
      const out = { ...image, rgba: image.rgba.slice() };
      for (let i = 0; i < out.rgba.length; i += 4) {
        if (out.rgba[i + 3] === 0) continue;
        const to = map.get((out.rgba[i]! << 16) | (out.rgba[i + 1]! << 8) | out.rgba[i + 2]!);
        if (to === undefined) continue;
        out.rgba[i] = to >> 16;
        out.rgba[i + 1] = (to >> 8) & 0xff;
        out.rgba[i + 2] = to & 0xff;
      }
      return out;
    },
  },
  keyOut: {
    parse: (o, where) => {
      onlyFields(o, ['op', 'colors'], where);
      if (!Array.isArray(o.colors) || o.colors.length === 0) {
        throw new Error(`${where}.colors must be a non-empty list of "#rrggbb" colors`);
      }
      return {
        op: 'keyOut',
        colors: o.colors.map((c, i) => color(c, `${where}.colors[${i}]`)),
      };
    },
    apply: (image, op) => {
      const keys = new Set(op.colors.map(rgbKey));
      const out = { ...image, rgba: image.rgba.slice() };
      for (let i = 0; i < out.rgba.length; i += 4) {
        const rgb = (out.rgba[i]! << 16) | (out.rgba[i + 1]! << 8) | out.rgba[i + 2]!;
        if (out.rgba[i + 3] !== 0 && keys.has(rgb)) out.rgba.fill(0, i, i + 4);
      }
      return out;
    },
  },
  flipX: {
    parse: (o, where) => {
      onlyFields(o, ['op'], where);
      return { op: 'flipX' };
    },
    apply: (image) => {
      const out = blank(image.width, image.height);
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const s = (y * image.width + (image.width - 1 - x)) * 4;
          out.rgba.set(image.rgba.subarray(s, s + 4), (y * image.width + x) * 4);
        }
      }
      return out;
    },
  },
  compose: {
    parse: (o, where) => {
      onlyFields(o, ['op', 'size', 'at', 'layers'], where);
      if (!Array.isArray(o.layers) || o.layers.length === 0) {
        throw new Error(`${where}.layers must be a non-empty list`);
      }
      return {
        op: 'compose',
        size: size(o.size, `${where}.size`),
        ...(o.at !== undefined ? { at: point(o.at, `${where}.at`) } : {}),
        layers: o.layers.map((layer, i) => parseLayer(layer, `${where}.layers[${i}]`)),
      };
    },
    apply: (image, op, ctx, where) => {
      const canvas = blank(op.size[0], op.size[1]);
      paste(canvas, image, op.at ?? [0, 0], where);
      op.layers.forEach((layer, i) => {
        const at = `${where}.layers[${i}]`;
        const file = layer.file ?? ctx.file;
        let piece = crop(ctx.sheet(file), layer.rect, `${at}.rect (${file})`);
        piece = applyOps(piece, layer.ops ?? [], { ...ctx, file }, `${at}.ops`);
        paste(canvas, piece, layer.at, at);
      });
      return canvas;
    },
  },
};

/** Applies ops in order. */
export function applyOps(
  image: RgbaImage,
  ops: readonly Op[],
  ctx: OpContext,
  where: string,
): RgbaImage {
  return ops.reduce((img, op, i) => {
    const kind = OPS[op.op] as OpKind<Op>;
    return kind.apply(img, op, ctx, `${where}[${i}] (${op.op})`);
  }, image);
}

/** Cuts one entry: every frame cropped and edited, side by side. */
export function cutSprite(spec: CutSpec, sheet: (file: string) => RgbaImage, where: string): Cut {
  const source = sheet(spec.file);
  const count = spec.frames?.count ?? 1;
  const [x, y, w, h] = spec.rect;
  const frames: RgbaImage[] = [];
  for (let k = 0; k < count; k++) {
    const at = count > 1 ? `${where} frame ${k}` : where;
    const r: Rect = [x + k * (spec.frames?.dx ?? 0), y + k * (spec.frames?.dy ?? 0), w, h];
    if (r[0] < 0 || r[1] < 0) throw new Error(`${at}: [${r.join(', ')}] is off the sheet`);
    const frame = crop(source, r, `${at}.rect (${spec.file})`);
    frames.push(applyOps(frame, spec.ops ?? [], { file: spec.file, sheet }, `${at}.ops`));
  }
  const fw = frames[0]!.width;
  const fh = frames[0]!.height;
  const image = blank(fw * count, fh);
  frames.forEach((frame, k) => {
    for (let row = 0; row < fh; row++) {
      image.rgba.set(
        frame.rgba.subarray(row * fw * 4, (row + 1) * fw * 4),
        (row * fw * count + k * fw) * 4,
      );
    }
  });
  return { image, w: fw, h: fh, frames: count, ...(spec.frames ? { ms: spec.frames.ms } : {}) };
}

// ---------------------------------------------------------------------------------------
// Records: index.json and assets/licenses.json.

/** A cut's line in assets/limezu/index.json. */
export function cutRecord(cut: Cut, spec: CutSpec): CutRecord {
  return {
    w: cut.w,
    h: cut.h,
    ...(cut.frames > 1 ? { frames: cut.frames, ms: cut.ms! } : {}),
    spec: specHash(spec),
  };
}

export function cutIndexText(index: CutIndex): string {
  const sorted = Object.fromEntries(
    Object.keys(index)
      .sort(byString)
      .map((id) => [id, index[id]]),
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

function rectText(r: Rect): string {
  return `[${r.join(', ')}]`;
}

/** Every sheet rect an entry reads, as "<file> [x, y, w, h]". */
export function sourceRects(spec: CutSpec): string[] {
  const { frames } = spec;
  const out = [
    `${spec.file} ${rectText(spec.rect)}${frames ? `, ${frames.count} frames [${frames.dx}, ${frames.dy}] apart` : ''}`,
  ];
  const visit = (ops: readonly Op[], file: string) => {
    for (const op of ops) {
      if (op.op !== 'compose') continue;
      for (const layer of op.layers) {
        const layerFile = layer.file ?? file;
        out.push(`${layerFile} ${rectText(layer.rect)}`);
        visit(layer.ops ?? [], layerFile);
      }
    }
  };
  visit(spec.ops ?? [], spec.file);
  return out;
}

/** A cut's assets/licenses.json entry. */
export function licenseRecord(spec: CutSpec): LicenseRecord {
  const pack = PACKS[spec.pack];
  return {
    source: `${pack.page} (${pack.zip}): ${sourceRects(spec).join('; ')}`,
    author: 'LimeZu',
    license: pack.license,
  };
}

/** index.json's own entry: generated metadata, no pixels. */
export const INDEX_LICENSE: LicenseRecord = {
  source: "Generated by scripts/cut-art.ts from art/limezu/: each cut's size and spec hash",
  author: 'Open House team',
  license: 'Own work',
};

/**
 * assets/licenses.json with its limezu/ entries regenerated: every other entry untouched and in
 * its order, then limezu/index.json, then one entry per cut by id.
 */
export function mergeLicenses(
  existing: Readonly<Record<string, unknown>>,
  specs: ReadonlyMap<string, CutSpec>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!key.startsWith(CUTS_PREFIX)) out[key] = value;
  }
  out[`${CUTS_PREFIX}index.json`] = INDEX_LICENSE;
  for (const id of [...specs.keys()].sort(byString)) {
    out[`${CUTS_PREFIX}${id}.png`] = licenseRecord(specs.get(id)!);
  }
  return out;
}

export function jsonText(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// ---------------------------------------------------------------------------------------
// Running it.

/** art-source/ in the main checkout, from any worktree: next to git's common directory. */
export function findArtSource(cwd: string): string {
  let common: string;
  try {
    common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(
      `can't find the main checkout: git rev-parse failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return join(dirname(common), 'art-source');
}

/** Opens packs as they're needed, and decodes each sheet once. */
export function openSheets(artSource: string): {
  get(pack: PackId, file: string): RgbaImage;
  close(): void;
} {
  const zips = new Map<PackId, Zip>();
  const sheets = new Map<string, RgbaImage>();
  return {
    get(pack, file) {
      const key = `${pack}:${file}`;
      let sheet = sheets.get(key);
      if (!sheet) {
        let zip = zips.get(pack);
        if (!zip) {
          const path = join(artSource, PACKS[pack].zip);
          if (!existsSync(path)) {
            throw new Error(
              `${path} isn't there. npm run art:cut reads LimeZu's ${PACKS[pack].name} zip from art-source/ (gitignored, in the main checkout); CI uses the committed cuts instead.`,
            );
          }
          zip = openZip(path);
          zips.set(pack, zip);
        }
        sheet = decodePng(zip.read(file), `${PACKS[pack].zip}: ${file}`);
        sheets.set(key, sheet);
      }
      return sheet;
    },
    close() {
      for (const zip of zips.values()) zip.close();
    },
  };
}

export interface CutPaths {
  /** art/limezu/ */
  readonly manifests: string;
  /** assets/, which holds limezu/ and licenses.json */
  readonly assets: string;
  /** art-source/; only looked for when a manifest lists something. */
  readonly artSource: () => string;
}

export interface CutResult {
  readonly ids: readonly string[];
  /** Files written or rewritten, as paths under assets/. */
  readonly written: readonly string[];
  /** Cuts removed because no manifest lists them, as paths under assets/. */
  readonly removed: readonly string[];
}

function samePixels(path: string, image: RgbaImage): boolean {
  if (!existsSync(path)) return false;
  try {
    const old = decodePng(readFileSync(path), path);
    return (
      old.width === image.width &&
      old.height === image.height &&
      Buffer.from(old.rgba).equals(Buffer.from(image.rgba))
    );
  } catch {
    return false;
  }
}

/**
 * Cuts every manifest entry, then writes the cuts, index.json, and licenses.json's limezu/
 * entries, and removes cuts no manifest lists. Everything is cut before anything is written,
 * so an error leaves assets/ as it was. A cut whose pixels haven't changed isn't rewritten.
 */
export function runCut(paths: CutPaths): CutResult {
  const entries = readManifests(paths.manifests);
  const cuts = new Map<string, Cut>();
  if (entries.size > 0) {
    const sheets = openSheets(paths.artSource());
    try {
      for (const [id, { manifest, spec }] of entries) {
        cuts.set(
          id,
          cutSprite(spec, (file) => sheets.get(spec.pack, file), `${manifest}: "${id}"`),
        );
      }
    } finally {
      sheets.close();
    }
  }

  const dir = join(paths.assets, 'limezu');
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const removed: string[] = [];
  const write = (path: string, data: string | Uint8Array) => {
    if (existsSync(path) && readFileSync(path).equals(Buffer.from(data))) return;
    writeFileSync(path, data);
    written.push(relative(paths.assets, path));
  };

  for (const [id, cut] of cuts) {
    const path = join(dir, `${id}.png`);
    if (samePixels(path, cut.image)) continue;
    writeFileSync(path, encodePng(cut.image.width, cut.image.height, cut.image.rgba));
    written.push(relative(paths.assets, path));
  }
  for (const name of readdirSync(dir).sort(byString)) {
    if (name.endsWith('.png') && !cuts.has(name.slice(0, -'.png'.length))) {
      unlinkSync(join(dir, name));
      removed.push(`limezu/${name}`);
    }
  }
  const index: Record<string, CutRecord> = {};
  for (const [id, cut] of cuts) index[id] = cutRecord(cut, entries.get(id)!.spec);
  write(join(dir, 'index.json'), cutIndexText(index));

  const licensesPath = join(paths.assets, 'licenses.json');
  const existing: unknown = existsSync(licensesPath)
    ? JSON.parse(readFileSync(licensesPath, 'utf8'))
    : {};
  if (!isRecord(existing)) throw new Error('assets/licenses.json must be an object');
  const specs = new Map([...entries].map(([id, entry]) => [id, entry.spec]));
  write(licensesPath, jsonText(mergeLicenses(existing, specs)));

  return { ids: [...cuts.keys()], written, removed };
}

function main(): void {
  const root = resolve(import.meta.dirname, '..');
  const result = runCut({
    manifests: join(root, 'art', 'limezu'),
    assets: join(root, 'assets'),
    artSource: () => findArtSource(root),
  });
  const list = (files: readonly string[]) => (files.length > 0 ? files.join(', ') : 'none');
  console.log(
    `art:cut: ${result.ids.length} LimeZu cuts. Written: ${list(result.written)}. Removed: ${list(result.removed)}.`,
  );
  if (result.written.length > 0 || result.removed.length > 0) {
    console.log('Now run `npm run atlas`, and commit assets/ with the manifests.');
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `npm run art:cut failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
