// Cuts the sounds and music the game plays (M5b, D-058; implementation-plan.md §12 Sound,
// Music, and Audio sources and licenses), the way scripts/cut-art.ts cuts the sprites.
//
// art/audio.json is the manifest. Its "sources" name where the files come from (a folder or a
// zip in art-source/audio/, with its page, author, and license), and its "cuts" map each output
// (a path under assets/audio/, without its extension) to one source file and how to edit it:
//
//   "sfx/marimba-c5": {
//     "from": "vcsl",
//     "file": "Idiophones/Struck Idiophones/Marimba/Marimba_hit_Outrigger_C4_med_01.wav",
//     "length": 1.2, "fade": 0.6,
//     "note": "Why this file, in a few words."
//   }
//
// Edits, in order: start (seconds into the file, default: the sound's onset, found where it
// first reaches 3% of its peak, less 3 ms), length (seconds, default: to the end), a 3 ms fade
// in and `fade` seconds faded out at the end, `lowpass` (Hz), mono unless `stereo`, and then
// the level: `loudness` (an integrated loudness in LUFS, for music) or `peak` (dBFS, default
// −1), never over −1 dBFS. Each cut is encoded twice: Ogg Vorbis (`quality`, default 3) and
// AAC in an M4A (`kbps`, default 64 mono or 128 stereo), the fallback for Safari (§12 Music).
//
// `npm run audio:cut` runs locally only, on macOS: it needs oggenc and oggdec (Homebrew's
// vorbis-tools) and afconvert (part of macOS). It reads art-source/audio/ in the main checkout
// (gitignored, found as scripts/cut-art.ts finds art-source/) and writes:
// - assets/audio/<cut>.ogg and .m4a
// - assets/audio/index.json: each cut's length and its manifest entry's and source's hash
// - assets/licenses.json's audio/ entries: one per file, plus index.json's
// A cut whose entry and source haven't changed isn't encoded again (the encoders' output isn't
// byte-for-byte repeatable), and cuts the manifest no longer lists are removed. CI uses only
// the committed files; scripts/cut-audio.test.ts checks them against the manifest.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findArtSource, jsonText } from './cut-art.ts';
import { openZip, type Zip } from './zip.ts';

export const AUDIO_PREFIX = 'audio/';
export const FORMATS = ['ogg', 'm4a'] as const;

export interface AudioSource {
  /** A folder or a zip, as a path under art-source/audio/. */
  readonly path: string;
  readonly page: string;
  readonly author: string;
  readonly license: string;
}

export interface AudioCut {
  readonly from: string;
  /** The file's path in the source folder or zip. */
  readonly file: string;
  readonly start?: number;
  readonly length?: number;
  readonly fade?: number;
  readonly lowpass?: number;
  readonly stereo?: boolean;
  readonly loudness?: number;
  readonly peak?: number;
  readonly quality?: number;
  readonly kbps?: number;
  readonly note?: string;
}

export interface AudioManifest {
  readonly sources: Readonly<Record<string, AudioSource>>;
  readonly cuts: Readonly<Record<string, AudioCut>>;
}

export interface AudioIndexEntry {
  /** The manifest entry's and the source file's hash: unchanged, the cut isn't redone. */
  readonly hash: string;
  readonly seconds: number;
  readonly channels: number;
}

const CUT_ID = /^(sfx|music)\/[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/;
const CUT_KEYS = new Set([
  'from',
  'file',
  'start',
  'length',
  'fade',
  'lowpass',
  'stereo',
  'loudness',
  'peak',
  'quality',
  'kbps',
  'note',
]);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function parseAudioManifest(json: string, where = 'art/audio.json'): AudioManifest {
  const raw: unknown = JSON.parse(json);
  const fail = (message: string): never => {
    throw new Error(`${where}: ${message}`);
  };
  if (!isRecord(raw) || !isRecord(raw.sources) || !isRecord(raw.cuts)) {
    return fail('expected { "sources": {...}, "cuts": {...} }');
  }
  const sources: Record<string, AudioSource> = {};
  for (const [id, s] of Object.entries(raw.sources)) {
    if (!isRecord(s)) return fail(`source "${id}" must be an object`);
    for (const k of ['path', 'page', 'author', 'license'] as const) {
      if (typeof s[k] !== 'string' || s[k] === '') fail(`source "${id}" needs a "${k}"`);
    }
    sources[id] = s as unknown as AudioSource;
  }
  const cuts: Record<string, AudioCut> = {};
  for (const [id, c] of Object.entries(raw.cuts)) {
    if (!CUT_ID.test(id)) fail(`cut "${id}": ids are sfx/<name> or music/<track>/<stem>`);
    if (!isRecord(c)) return fail(`cut "${id}" must be an object`);
    for (const k of Object.keys(c)) if (!CUT_KEYS.has(k)) fail(`cut "${id}": unknown key "${k}"`);
    if (typeof c.from !== 'string' || !(c.from in sources)) fail(`cut "${id}": unknown source`);
    if (typeof c.file !== 'string' || c.file === '') fail(`cut "${id}" needs a "file"`);
    for (const k of ['start', 'length', 'fade', 'lowpass', 'loudness', 'peak', 'quality', 'kbps']) {
      if (k in c && (typeof c[k] !== 'number' || !Number.isFinite(c[k] as number))) {
        fail(`cut "${id}": "${k}" must be a number`);
      }
    }
    cuts[id] = c as unknown as AudioCut;
  }
  return { sources, cuts };
}

/** A cut's hash: its manifest entry (the note left out) and its source's bytes. */
export function cutHash(cut: AudioCut, source: AudioSource, bytes: Uint8Array): string {
  const { note: _note, ...spec } = cut;
  return createHash('sha256')
    .update(JSON.stringify({ spec, path: source.path }))
    .update(bytes)
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------------------
// WAV in and out.

export interface Pcm {
  readonly rate: number;
  readonly channels: Float32Array[];
}

export function readWav(buf: Uint8Array, where = 'wav'): Pcm {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${where}: not a WAV file`);
  }
  let p = 12;
  let format = 0;
  let channelCount = 0;
  let rate = 0;
  let bits = 0;
  let data: Buffer | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4);
    const size = b.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === 'fmt ') {
      format = b.readUInt16LE(body);
      channelCount = b.readUInt16LE(body + 2);
      rate = b.readUInt32LE(body + 4);
      bits = b.readUInt16LE(body + 14);
      if (format === 0xfffe) format = b.readUInt16LE(body + 24);
    } else if (id === 'data') {
      data = b.subarray(body, Math.min(b.length, body + size));
    }
    p = body + size + (size % 2);
  }
  if (!data || !rate || !channelCount) throw new Error(`${where}: no fmt or data chunk`);
  const bytes = bits / 8;
  if (
    !(format === 1 && [1, 2, 3, 4].includes(bytes)) &&
    !(format === 3 && [4, 8].includes(bytes))
  ) {
    throw new Error(`${where}: unsupported WAV format ${format}, ${bits}-bit`);
  }
  const frames = Math.floor(data.length / (bytes * channelCount));
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channelCount; c++) {
      const o = (i * channelCount + c) * bytes;
      let v: number;
      if (format === 3) v = bytes === 4 ? data.readFloatLE(o) : data.readDoubleLE(o);
      else if (bytes === 1) v = (data.readUInt8(o) - 128) / 128;
      else if (bytes === 2) v = data.readInt16LE(o) / 32768;
      else if (bytes === 3) v = data.readIntLE(o, 3) / 8388608;
      else v = data.readInt32LE(o) / 2147483648;
      channels[c]![i] = v;
    }
  }
  return { rate, channels };
}

/** 16-bit PCM, with TPDF dither. */
export function writeWav(pcm: Pcm, random: () => number = Math.random): Buffer {
  const n = pcm.channels[0]?.length ?? 0;
  const ch = pcm.channels.length;
  const out = Buffer.alloc(44 + n * ch * 2);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + n * ch * 2, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(ch, 22);
  out.writeUInt32LE(pcm.rate, 24);
  out.writeUInt32LE(pcm.rate * ch * 2, 28);
  out.writeUInt16LE(ch * 2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const dither = (random() - random()) / 32768;
      const v = Math.round((pcm.channels[c]![i]! + dither) * 32767);
      out.writeInt16LE(Math.max(-32768, Math.min(32767, v)), 44 + (i * ch + c) * 2);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The edits. Pure, so the tests can run them.

const dbToGain = (db: number) => 10 ** (db / 20);

export function peakOf(pcm: Pcm): number {
  let peak = 0;
  for (const c of pcm.channels) for (const v of c) peak = Math.max(peak, Math.abs(v));
  return peak;
}

/** Where the sound starts: the first frame at 3% of its peak, less 3 ms. */
export function onsetOf(pcm: Pcm): number {
  const peak = peakOf(pcm);
  const n = pcm.channels[0]?.length ?? 0;
  for (let i = 0; i < n; i++) {
    for (const c of pcm.channels) {
      if (Math.abs(c[i]!) >= peak * 0.03) return Math.max(0, i - Math.round(pcm.rate * 0.003));
    }
  }
  return 0;
}

function slice(pcm: Pcm, from: number, frames: number): Pcm {
  return {
    rate: pcm.rate,
    channels: pcm.channels.map((c) => c.slice(from, from + Math.max(0, frames))),
  };
}

function toMono(pcm: Pcm): Pcm {
  if (pcm.channels.length === 1) return pcm;
  const n = pcm.channels[0]!.length;
  const m = new Float32Array(n);
  for (const c of pcm.channels) for (let i = 0; i < n; i++) m[i]! += c[i]! / pcm.channels.length;
  return { rate: pcm.rate, channels: [m] };
}

function fades(pcm: Pcm, fadeIn: number, fadeOut: number): void {
  const n = pcm.channels[0]?.length ?? 0;
  const fi = Math.min(n, Math.round(fadeIn * pcm.rate));
  const fo = Math.min(n, Math.round(fadeOut * pcm.rate));
  for (const c of pcm.channels) {
    for (let i = 0; i < fi; i++) c[i]! *= i / fi;
    // A raised-cosine fade out, down to zero on the last frame.
    for (let i = 0; i < fo; i++) c[n - fo + i]! *= 0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / fo);
  }
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function runBiquad(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i]! + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** A 12 dB/octave low-pass (RBJ's cookbook, Q = 0.707). */
export function lowpassFilter(rate: number, hz: number): Biquad {
  const w = (2 * Math.PI * Math.min(hz, rate * 0.45)) / rate;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Integrated loudness in LUFS (ITU-R BS.1770-4): K-weighting, 400 ms blocks with 75% overlap,
 * the absolute gate at −70 LUFS and the relative gate 10 LU under the ungated mean.
 */
export function loudnessOf(pcm: Pcm): number {
  const rate = pcm.rate;
  // The K-weighting's two stages, from the standard's formulas for any sample rate.
  const shelf = (() => {
    const f0 = 1681.974450955533;
    const g = 3.999843853973347;
    const q = 0.7071752369554196;
    const k = Math.tan((Math.PI * f0) / rate);
    const vh = 10 ** (g / 20);
    const vb = vh ** 0.4996667741545416;
    const a0 = 1 + k / q + k * k;
    return {
      b0: (vh + (vb * k) / q + k * k) / a0,
      b1: (2 * (k * k - vh)) / a0,
      b2: (vh - (vb * k) / q + k * k) / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    };
  })();
  const highpass = (() => {
    const f0 = 38.13547087602444;
    const q = 0.5003270373238773;
    const k = Math.tan((Math.PI * f0) / rate);
    const a0 = 1 + k / q + k * k;
    return {
      b0: 1 / a0,
      b1: -2 / a0,
      b2: 1 / a0,
      a1: (2 * (k * k - 1)) / a0,
      a2: (1 - k / q + k * k) / a0,
    };
  })();
  const weighted = pcm.channels.map((c) => runBiquad(runBiquad(c, shelf), highpass));
  const block = Math.round(rate * 0.4);
  const step = Math.round(rate * 0.1);
  const n = weighted[0]?.length ?? 0;
  const powers: number[] = [];
  for (let start = 0; start + block <= n; start += step) {
    let sum = 0;
    for (const c of weighted) {
      let s = 0;
      for (let i = start; i < start + block; i++) s += c[i]! * c[i]!;
      sum += s / block;
    }
    powers.push(sum);
  }
  const lufs = (p: number) => -0.691 + 10 * Math.log10(p);
  const mean = (ps: readonly number[]) => ps.reduce((a, p) => a + p, 0) / Math.max(1, ps.length);
  const absolute = powers.filter((p) => lufs(p) > -70);
  if (absolute.length === 0) return -Infinity;
  const relativeGate = lufs(mean(absolute)) - 10;
  const gated = absolute.filter((p) => lufs(p) > relativeGate);
  return lufs(mean(gated));
}

/** Applies a cut's edits to its decoded source. */
export function editCut(source: Pcm, cut: AudioCut): Pcm {
  const start = cut.start !== undefined ? Math.round(cut.start * source.rate) : onsetOf(source);
  const total = source.channels[0]?.length ?? 0;
  const frames = cut.length !== undefined ? Math.round(cut.length * source.rate) : total - start;
  let pcm = slice(source, start, Math.min(frames, total - start));
  if (!cut.stereo) pcm = toMono(pcm);
  else if (pcm.channels.length === 1)
    pcm = { rate: pcm.rate, channels: [pcm.channels[0]!, pcm.channels[0]!.slice()] };
  fades(pcm, 0.003, cut.fade ?? 0);
  if (cut.lowpass !== undefined) {
    const f = lowpassFilter(pcm.rate, cut.lowpass);
    pcm = { rate: pcm.rate, channels: pcm.channels.map((c) => runBiquad(c, f)) };
  }
  const peak = peakOf(pcm);
  if (peak === 0) throw new Error('the cut is silent');
  let gain: number;
  if (cut.loudness !== undefined) {
    gain = dbToGain(cut.loudness - loudnessOf(pcm));
  } else {
    gain = dbToGain(cut.peak ?? -1) / peak;
  }
  gain = Math.min(gain, dbToGain(-1) / peak);
  for (const c of pcm.channels) for (let i = 0; i < c.length; i++) c[i]! *= gain;
  return pcm;
}

// ---------------------------------------------------------------------------------------
// Decoding and encoding, through the command-line tools.

function run(cmd: string, args: readonly string[]): void {
  execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

/** Decodes a source file's bytes (WAV directly; Ogg with oggdec; others with afconvert). */
export function decodeAudio(bytes: Uint8Array, name: string, tmp: string): Pcm {
  const ext = extname(name).toLowerCase();
  if (ext === '.wav') return readWav(bytes, name);
  const input = join(tmp, `in${ext}`);
  const output = join(tmp, 'decoded.wav');
  writeFileSync(input, bytes);
  if (ext === '.ogg') run('oggdec', ['-Q', '-o', output, input]);
  else run('afconvert', ['-f', 'WAVE', '-d', 'LEI16', input, output]);
  return readWav(readFileSync(output), name);
}

function encode(pcm: Pcm, cut: AudioCut, out: string, tmp: string): void {
  const wav = join(tmp, 'cut.wav');
  writeFileSync(wav, writeWav(pcm));
  mkdirSync(dirname(out), { recursive: true });
  const stereo = pcm.channels.length > 1;
  run('oggenc', ['-Q', '--serial', '1', '-q', String(cut.quality ?? 3), '-o', `${out}.ogg`, wav]);
  const bitrate = (cut.kbps ?? (stereo ? 128 : 64)) * 1000;
  run('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', String(bitrate), wav, `${out}.m4a`]);
}

// ---------------------------------------------------------------------------------------
// Records.

/** A file's assets/licenses.json entry. */
export function audioLicense(cut: AudioCut, source: AudioSource): Record<string, string> {
  return {
    source: `${source.page} (${source.path}): ${cut.file}`,
    author: source.author,
    license: source.license,
  };
}

export const AUDIO_INDEX_LICENSE = {
  source: "Generated by scripts/cut-audio.ts from art/audio.json: each cut's length and hash",
  author: 'Open House team',
  license: 'Own work',
};

/** assets/licenses.json with its audio/ entries regenerated, every other entry untouched. */
export function mergeAudioLicenses(
  existing: Readonly<Record<string, unknown>>,
  manifest: AudioManifest,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!key.startsWith(AUDIO_PREFIX)) out[key] = value;
  }
  out[`${AUDIO_PREFIX}index.json`] = AUDIO_INDEX_LICENSE;
  for (const id of Object.keys(manifest.cuts).sort(byString)) {
    const cut = manifest.cuts[id]!;
    for (const ext of FORMATS) {
      out[`${AUDIO_PREFIX}${id}.${ext}`] = audioLicense(cut, manifest.sources[cut.from]!);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Running it.

function sourceBytes(
  artAudio: string,
  source: AudioSource,
  file: string,
  zips: Map<string, Zip>,
): Uint8Array {
  const path = join(artAudio, source.path);
  if (source.path.endsWith('.zip')) {
    let zip = zips.get(path);
    if (!zip) {
      zip = openZip(path);
      zips.set(path, zip);
    }
    return zip.read(file);
  }
  return readFileSync(join(path, file));
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

export function runAudioCut(
  root: string,
  artSource: () => string,
): {
  cut: string[];
  kept: string[];
  removed: string[];
} {
  const manifest = parseAudioManifest(readFileSync(join(root, 'art', 'audio.json'), 'utf8'));
  const assets = join(root, 'assets');
  const dir = join(assets, 'audio');
  const indexPath = join(dir, 'index.json');
  const oldIndex: Record<string, AudioIndexEntry> = existsSync(indexPath)
    ? JSON.parse(readFileSync(indexPath, 'utf8'))
    : {};
  const index: Record<string, AudioIndexEntry> = {};
  const cut: string[] = [];
  const kept: string[] = [];
  const zips = new Map<string, Zip>();
  const tmp = mkdtempSync(join(tmpdir(), 'cut-audio-'));
  try {
    const artAudio = join(artSource(), 'audio');
    for (const id of Object.keys(manifest.cuts).sort(byString)) {
      const spec = manifest.cuts[id]!;
      const source = manifest.sources[spec.from]!;
      const bytes = sourceBytes(artAudio, source, spec.file, zips);
      const hash = cutHash(spec, source, bytes);
      const out = join(dir, id);
      const old = oldIndex[id];
      if (old?.hash === hash && FORMATS.every((ext) => existsSync(`${out}.${ext}`))) {
        index[id] = old;
        kept.push(id);
        continue;
      }
      const pcm = editCut(decodeAudio(bytes, spec.file, tmp), spec);
      encode(pcm, spec, out, tmp);
      index[id] = {
        hash,
        seconds: Math.round(((pcm.channels[0]?.length ?? 0) / pcm.rate) * 1000) / 1000,
        channels: pcm.channels.length,
      };
      cut.push(id);
    }
  } finally {
    for (const zip of zips.values()) zip.close();
    rmSync(tmp, { recursive: true, force: true });
  }
  const removed: string[] = [];
  const wanted = new Set(
    Object.keys(manifest.cuts).flatMap((id) => FORMATS.map((e) => `${id}.${e}`)),
  );
  for (const path of listFiles(dir)) {
    const rel = relative(dir, path).split('\\').join('/');
    if (rel === 'index.json' || wanted.has(rel)) continue;
    unlinkSync(path);
    removed.push(rel);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(indexPath, jsonText(index));
  const licensesPath = join(assets, 'licenses.json');
  const existing = JSON.parse(readFileSync(licensesPath, 'utf8')) as Record<string, unknown>;
  writeFileSync(licensesPath, jsonText(mergeAudioLicenses(existing, manifest)));
  return { cut, kept, removed };
}

function main(): void {
  const root = resolve(import.meta.dirname, '..');
  const result = runAudioCut(root, () => findArtSource(root));
  const list = (xs: readonly string[]) => (xs.length > 0 ? xs.join(', ') : 'none');
  console.log(
    `audio:cut: ${result.cut.length} cut, ${result.kept.length} unchanged. Cut: ${list(result.cut)}. Removed: ${list(result.removed)}.`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
