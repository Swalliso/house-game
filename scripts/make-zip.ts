// Test support for zip.test.ts and cut-art.test.ts: builds small zips in memory, so the tests
// never need LimeZu's packs. Not used by the scripts themselves.

import { deflateRawSync } from 'node:zlib';
import { crc32 } from './png.ts';

export interface ZipFixtureEntry {
  readonly name: string;
  /** A directory entry when the name ends with "/"; leave data empty. */
  readonly data: Uint8Array;
  /** 0 = Stored (the default), 8 = Deflate, anything else to test errors. */
  readonly method?: number;
  /** General-purpose flags; bit 3 writes a data descriptor and zero sizes locally. */
  readonly flags?: number;
  /** An extra field in the local header only, which the reader must skip. */
  readonly localExtra?: Uint8Array;
  /** Overrides the CRC-32 written to the central directory. */
  readonly crc?: number;
}

/** A zip file: local headers and data, the central directory, and the end record. */
export function makeZip(entries: readonly ZipFixtureEntry[], comment = ''): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 0;
    const flags = entry.flags ?? 0;
    const name = Buffer.from(entry.name, 'utf8');
    const extra = Buffer.from(entry.localExtra ?? new Uint8Array(0));
    const stored = Buffer.from(method === 8 ? deflateRawSync(entry.data) : entry.data);
    const crc = entry.crc ?? crc32(entry.data);
    const descriptor = (flags & 0x8) !== 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(descriptor ? 0 : crc, 14);
    local.writeUInt32LE(descriptor ? 0 : stored.length, 18);
    local.writeUInt32LE(descriptor ? 0 : entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    const parts = [local, name, extra, stored];
    if (descriptor) {
      const dd = Buffer.alloc(16);
      dd.writeUInt32LE(0x08074b50, 0);
      dd.writeUInt32LE(crc, 4);
      dd.writeUInt32LE(stored.length, 8);
      dd.writeUInt32LE(entry.data.length, 12);
      parts.push(dd);
    }
    const block = Buffer.concat(parts);
    locals.push(block);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags | 0x800, 8); // bit 11: UTF-8 names
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += block.length;
  }
  const directory = Buffer.concat(centrals);
  const note = Buffer.from(comment, 'utf8');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(note.length, 20);
  return Buffer.concat([...locals, directory, end, note]);
}
