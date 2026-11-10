// The committed audio against its manifest (art/audio.json), and the cut's edits. The sources
// stay out of the repo, so CI can't cut again; this checks what `npm run audio:cut` left.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  audibleSpan,
  audioLicense,
  AUDIO_PREFIX,
  editCut,
  FORMATS,
  loudnessOf,
  parseAudioManifest,
  peakOf,
  readWav,
  writeWav,
  type Pcm,
} from './cut-audio.ts';

const root = resolve(import.meta.dirname, '..');
const manifest = parseAudioManifest(readFileSync(join(root, 'art', 'audio.json'), 'utf8'));
const audioDir = join(root, 'assets', 'audio');
const index = JSON.parse(readFileSync(join(audioDir, 'index.json'), 'utf8')) as Record<
  string,
  { hash: string; seconds: number; channels: number }
>;
const licenses = JSON.parse(readFileSync(join(root, 'assets', 'licenses.json'), 'utf8')) as Record<
  string,
  Record<string, string>
>;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [relative(audioDir, path)];
  });
}

describe('assets/audio/', () => {
  it('holds every cut in both formats, and nothing else', () => {
    const wanted = new Set(['index.json']);
    for (const id of Object.keys(manifest.cuts)) {
      for (const ext of FORMATS) {
        wanted.add(`${id}.${ext}`);
        expect(existsSync(join(audioDir, `${id}.${ext}`)), `${id}.${ext}: npm run audio:cut`).toBe(
          true,
        );
      }
      expect(index, `${id} has no index entry: npm run audio:cut`).toHaveProperty([id]);
    }
    expect(files(audioDir).filter((f) => !wanted.has(f.split('\\').join('/')))).toEqual([]);
    expect(Object.keys(index).filter((id) => !(id in manifest.cuts))).toEqual([]);
  });

  it('records each file with its source, author, and license', () => {
    for (const [id, cut] of Object.entries(manifest.cuts)) {
      for (const ext of FORMATS) {
        expect(licenses[`${AUDIO_PREFIX}${id}.${ext}`], `${id}.${ext}`).toEqual(
          audioLicense(cut, manifest.sources[cut.from]!),
        );
      }
    }
  });

  it('takes only licenses we accept (CC0 first, CC BY with credit; D-058)', () => {
    for (const [id, source] of Object.entries(manifest.sources)) {
      expect(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0'], id).toContain(source.license);
    }
  });
});

describe('the edits', () => {
  const tone = (rate: number, seconds: number, hz: number, amp: number, lead = 0): Pcm => {
    const n = Math.round(rate * seconds);
    const x = new Float32Array(n);
    for (let i = Math.round(rate * lead); i < n; i++)
      x[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
    return { rate, channels: [x, x.slice()] };
  };

  it('measures a full-scale 1 kHz sine at −3 LUFS', () => {
    const pcm = tone(48000, 5, 997, 1);
    expect(loudnessOf({ rate: 48000, channels: [pcm.channels[0]!] })).toBeCloseTo(-3.01, 1);
  });

  it('starts at the onset, cuts the length, fades out to silence, and sets the peak', () => {
    const out = editCut(tone(44100, 2, 440, 0.25, 0.5), {
      from: 'x',
      file: 'x.wav',
      length: 1,
      fade: 0.2,
    });
    expect(out.channels).toHaveLength(1);
    expect(out.channels[0]!.length).toBe(44100);
    expect(20 * Math.log10(peakOf(out))).toBeCloseTo(-1, 1);
    // The onset is kept, less 3 ms: nearly no silence at the start.
    const first = out.channels[0]!.findIndex((v) => Math.abs(v) > 0.01);
    expect(first).toBeLessThan(44100 * 0.006);
    expect(out.channels[0]![out.channels[0]!.length - 1]).toBeCloseTo(0, 4);
  });

  it('keeps a track’s quiet intro, trimming only near-silence', () => {
    const rate = 22050;
    const x = new Float32Array(rate * 3);
    // 0.5 s of silence, a quiet intro at −40 dBFS, a loud part, then 0.5 s of silence.
    for (let i = rate * 0.5; i < rate * 1.5; i++) x[i] = 0.01 * Math.sin(i / 3);
    for (let i = rate * 1.5; i < rate * 2.5; i++) x[i] = 0.8 * Math.sin(i / 3);
    const pcm: Pcm = { rate, channels: [x, x.slice()] };
    const [first, frames] = audibleSpan(pcm);
    expect(first / rate).toBeCloseTo(0.5, 2);
    expect(frames / rate).toBeCloseTo(2, 2);
    const out = editCut(pcm, { from: 'x', file: 'x.wav', stereo: true, loudness: -16 });
    expect(out.channels[0]!.length / rate).toBeCloseTo(2, 2);
  });

  it('sets a loudness, but never a peak over −1 dBFS', () => {
    const out = editCut(tone(44100, 4, 220, 0.1), {
      from: 'x',
      file: 'x.wav',
      stereo: true,
      loudness: -16,
    });
    expect(out.channels).toHaveLength(2);
    expect(loudnessOf(out)).toBeCloseTo(-16, 0);
    const loud = editCut(tone(44100, 4, 220, 0.1), { from: 'x', file: 'x.wav', loudness: 0 });
    expect(20 * Math.log10(peakOf(loud))).toBeLessThanOrEqual(-1 + 1e-6);
  });

  it('writes and reads 16-bit WAV', () => {
    const pcm = tone(22050, 0.1, 300, 0.5);
    const back = readWav(writeWav(pcm, () => 0.5));
    expect(back.rate).toBe(22050);
    expect(back.channels).toHaveLength(2);
    for (let i = 0; i < 100; i++) {
      expect(back.channels[0]![i]).toBeCloseTo(pcm.channels[0]![i]!, 3);
    }
  });
});
