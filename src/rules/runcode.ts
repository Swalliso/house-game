// Run codes (implementation-plan.md §6, D-039): `OH1.` + base64url of
// { build, contentHash, setup, actions, pending? }. A run is fully described by its setup and
// action log, so a run code replays any bug. The rules have no btoa or TextEncoder (no DOM
// lib), so UTF-8 and base64url are done by hand here.

import type { Action, Content, PieceId, PlaceAction, RunCodeData, RunSetup } from './index.ts';
import { fnv1a } from './rng.ts';

const PREFIX = 'OH1.';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Encode(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
    }
  }
  return bytes;
}

function utf8Decode(bytes: readonly number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i]!;
    let extra: number;
    let cp: number;
    if (b0 < 0x80) [extra, cp] = [0, b0];
    else if ((b0 & 0xe0) === 0xc0) [extra, cp] = [1, b0 & 0x1f];
    else if ((b0 & 0xf0) === 0xe0) [extra, cp] = [2, b0 & 0x0f];
    else if ((b0 & 0xf8) === 0xf0) [extra, cp] = [3, b0 & 0x07];
    else throw new Error('bad UTF-8');
    for (let k = 1; k <= extra; k++) {
      const b = bytes[i + k];
      if (b === undefined || (b & 0xc0) !== 0x80) throw new Error('bad UTF-8');
      cp = (cp << 6) | (b & 63);
    }
    if (cp > 0x10ffff) throw new Error('bad UTF-8');
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

export function base64urlEncode(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 4) / 3));
    for (let k = 0; k < chars; k++) out += ALPHABET[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

export function base64urlDecode(text: string): number[] {
  if (text.length % 4 === 1) throw new Error('bad base64url length');
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const ch = chunk[k];
      const v = ch === undefined ? 0 : ALPHABET.indexOf(ch);
      if (v < 0) throw new Error(`bad base64url character "${ch}"`);
      n = (n << 6) | v;
    }
    const count = chunk.length - 1;
    for (let k = 0; k < count; k++) bytes.push((n >> (16 - 8 * k)) & 255);
  }
  return bytes;
}

/** A short hash of the content, so a run code from different content is flagged. */
export function contentHash(content: Content): string {
  return fnv1a(JSON.stringify(content)).toString(16).padStart(8, '0');
}

export function encodeRunCode(data: RunCodeData): string {
  const payload: RunCodeData = {
    build: data.build,
    contentHash: data.contentHash,
    setup: data.setup,
    actions: data.actions,
    ...(data.pending ? { pending: data.pending } : {}),
  };
  return PREFIX + base64urlEncode(utf8Encode(JSON.stringify(payload)));
}

export type DecodeResult = { ok: true; data: RunCodeData } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isPlace(v: unknown): v is PlaceAction {
  return (
    isObject(v) &&
    v.t === 'place' &&
    v.from === 'hand' &&
    isInt(v.i) &&
    isInt(v.x) &&
    isInt(v.y) &&
    (v.rot === 0 || v.rot === 1 || v.rot === 2 || v.rot === 3)
  );
}

/**
 * Rebuilds an action from untrusted JSON with only its known fields, or null if it isn't one.
 * Piece ids and crews are checked against the content when the code replays.
 */
function cleanAction(v: unknown): Action | null {
  if (!isObject(v)) return null;
  switch (v.t) {
    case 'place':
      return isPlace(v) ? { t: 'place', from: 'hand', i: v.i, x: v.x, y: v.y, rot: v.rot } : null;
    case 'pass':
      return { t: 'pass' };
    case 'reroll':
      return { t: 'reroll' };
    case 'completeEarly':
      return { t: 'completeEarly' };
    case 'demolish':
      return isInt(v.x) && isInt(v.y) ? { t: 'demolish', x: v.x, y: v.y } : null;
    case 'setAutoComplete':
      return typeof v.on === 'boolean' ? { t: 'setAutoComplete', on: v.on } : null;
    case 'debug':
      switch (v.op) {
        case 'addScore':
        case 'addBudget':
          return isInt(v.amount) ? { t: 'debug', op: v.op, amount: v.amount } : null;
        case 'giveCard':
          return typeof v.id === 'string'
            ? { t: 'debug', op: 'giveCard', id: v.id as PieceId }
            : null;
        case 'forceMiss':
          return { t: 'debug', op: 'forceMiss' };
      }
      return null;
  }
  return null;
}

function isSetup(v: unknown): v is RunSetup {
  return (
    isObject(v) &&
    typeof v.seed === 'string' &&
    typeof v.crewId === 'string' &&
    v.mode === 'standard'
  );
}

/** Never throws: a bad or stale code is an error result, so loading never crashes the page. */
export function decodeRunCode(code: string): DecodeResult {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return { ok: false, error: 'A run code starts with "OH1."' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(base64urlDecode(trimmed.slice(PREFIX.length))));
  } catch {
    return { ok: false, error: 'That run code is damaged.' };
  }
  if (!isObject(parsed)) return { ok: false, error: 'That run code is damaged.' };
  const { build, contentHash: hash, setup, actions, pending } = parsed;
  if (typeof build !== 'string' || typeof hash !== 'string' || !isSetup(setup)) {
    return { ok: false, error: 'That run code is missing its setup.' };
  }
  const cleaned = Array.isArray(actions) ? actions.map(cleanAction) : null;
  if (!cleaned || cleaned.some((a) => a === null)) {
    return { ok: false, error: 'That run code has an action this build doesn’t know.' };
  }
  if (pending !== undefined && !isPlace(pending)) {
    return { ok: false, error: 'That run code has a damaged pending placement.' };
  }
  const data: RunCodeData = {
    build,
    contentHash: hash,
    setup: { seed: setup.seed, crewId: setup.crewId, mode: setup.mode },
    actions: cleaned as Action[],
    ...(pending
      ? {
          pending: {
            t: 'place',
            from: 'hand',
            i: pending.i,
            x: pending.x,
            y: pending.y,
            rot: pending.rot,
          },
        }
      : {}),
  };
  return { ok: true, data };
}
