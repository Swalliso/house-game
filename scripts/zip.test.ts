import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { makeZip, type ZipFixtureEntry } from './make-zip.ts';
import { openZip } from './zip.ts';

const dir = mkdtempSync(join(tmpdir(), 'open-house-zip-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let count = 0;
function zipFile(entries: readonly ZipFixtureEntry[], comment = ''): string {
  const path = join(dir, `test-${count++}.zip`);
  writeFileSync(path, makeZip(entries, comment));
  return path;
}

const text = (s: string) => new TextEncoder().encode(s);
/** Compressible bytes, so Deflate entries are really deflated. */
const big = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 13);

describe('openZip', () => {
  it('lists files and reads Stored and Deflate entries', () => {
    const zip = openZip(
      zipFile([
        { name: 'Pack/', data: new Uint8Array(0) },
        { name: 'Pack/stored.txt', data: text('hello, house') },
        { name: 'Pack/sheets/deflated.bin', data: big, method: 8 },
        { name: 'empty.txt', data: new Uint8Array(0) },
      ]),
    );
    try {
      expect([...zip.entries.keys()]).toEqual([
        'Pack/stored.txt',
        'Pack/sheets/deflated.bin',
        'empty.txt',
      ]);
      expect(zip.entries.get('Pack/sheets/deflated.bin')).toMatchObject({ method: 8, size: 5000 });
      expect(zip.entries.get('Pack/sheets/deflated.bin')!.compressedSize).toBeLessThan(5000);
      expect(zip.read('Pack/stored.txt').toString()).toBe('hello, house');
      expect([...zip.read('Pack/sheets/deflated.bin')]).toEqual([...big]);
      expect(zip.read('empty.txt').length).toBe(0);
    } finally {
      zip.close();
    }
  });

  it('finds the directory past a comment, and takes sizes from it, not the local header', () => {
    const zip = openZip(
      zipFile(
        [
          { name: 'a.bin', data: big, method: 8, flags: 0x8 }, // data descriptor: local sizes 0
          { name: 'b.txt', data: text('second'), localExtra: Uint8Array.of(1, 0, 2, 0, 9, 9) },
        ],
        'PK\u0005\u0006 looks like a signature, but this is the comment',
      ),
    );
    try {
      expect([...zip.read('a.bin')]).toEqual([...big]);
      expect(zip.read('b.txt').toString()).toBe('second');
    } finally {
      zip.close();
    }
  });

  it('reads UTF-8 names', () => {
    const zip = openZip(zipFile([{ name: 'Café/sheet.png', data: text('x') }]));
    expect(zip.read('Café/sheet.png').toString()).toBe('x');
    zip.close();
  });

  it('says what went wrong', () => {
    const zip = openZip(
      zipFile([
        { name: 'bad-crc.txt', data: text('abc'), crc: 12345 },
        { name: 'bzip2.bin', data: text('abc'), method: 12 },
        { name: 'secret.txt', data: text('abc'), flags: 0x1 },
      ]),
    );
    expect(() => zip.read('missing.png')).toThrow(/has no file missing\.png/);
    expect(() => zip.read('bad-crc.txt')).toThrow(/bad-crc\.txt fails its CRC-32 check/);
    expect(() => zip.read('bzip2.bin')).toThrow(/compression method 12/);
    expect(() => zip.read('secret.txt')).toThrow(/is encrypted/);
    zip.close();
    expect(() => zip.read('bad-crc.txt')).toThrow(/already closed/);
  });

  it('rejects files that are not zips', () => {
    const notZip = join(dir, 'not.zip');
    writeFileSync(notZip, 'this is not a zip file, just some text that is long enough');
    expect(() => openZip(notZip)).toThrow(/no end-of-central-directory record/);
    const tiny = join(dir, 'tiny.zip');
    writeFileSync(tiny, 'PK');
    expect(() => openZip(tiny)).toThrow(/too small to be a zip/);
  });
});
