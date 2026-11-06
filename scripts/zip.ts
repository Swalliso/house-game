// A small zip reader for the LimeZu packs in art-source/ (scripts/cut-art.ts, D-097). It reads
// the central directory, then one entry at a time by positioned reads, so a 230 MB zip is never
// loaded whole. Stored and Deflate entries only; zip64, encryption, and multi-disk archives are
// errors (the packs need none of them). It only returns bytes: nothing is extracted to disk,
// and nothing in a zip is run.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { crc32 } from './png.ts';

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;

export interface ZipEntry {
  readonly name: string;
  /** 0 = Stored, 8 = Deflate. */
  readonly method: number;
  readonly flags: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
}

export interface Zip {
  readonly path: string;
  /** Every file entry by its name in the zip (directories left out). */
  readonly entries: ReadonlyMap<string, ZipEntry>;
  /** One entry's bytes, checked against its size and CRC-32. */
  read(name: string): Buffer;
  close(): void;
}

function readAt(fd: number, position: number, length: number, path: string): Buffer {
  const buf = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const n = readSync(fd, buf, done, length - done, position + done);
    if (n === 0) throw new Error(`${path}: unexpected end of file`);
    done += n;
  }
  return buf;
}

/** Opens a zip and reads its central directory. Call close() when done. */
export function openZip(path: string): Zip {
  const fd = openSync(path, 'r');
  try {
    return readDirectory(fd, path);
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function readDirectory(fd: number, path: string): Zip {
  const fail = (message: string): never => {
    throw new Error(`${path}: ${message}`);
  };
  const fileSize = fstatSync(fd).size;
  if (fileSize < EOCD_SIZE) fail('too small to be a zip');

  // The end-of-central-directory record is the last 22 bytes, plus a comment of up to 64 KB.
  const tailLength = Math.min(fileSize, EOCD_SIZE + MAX_COMMENT);
  const tailStart = fileSize - tailLength;
  const tail = readAt(fd, tailStart, tailLength, path);
  let eocd = -1;
  for (let i = tailLength - EOCD_SIZE; i >= 0; i--) {
    if (
      tail.readUInt32LE(i) === EOCD_SIGNATURE &&
      i + EOCD_SIZE + tail.readUInt16LE(i + 20) === tailLength
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail('no end-of-central-directory record (not a zip, or damaged)');
  if (eocd >= 20 && tail.readUInt32LE(eocd - 20) === ZIP64_LOCATOR_SIGNATURE) {
    fail("zip64 archives aren't supported");
  }
  if (tail.readUInt16LE(eocd + 4) !== 0 || tail.readUInt16LE(eocd + 6) !== 0) {
    fail("multi-disk archives aren't supported");
  }
  const count = tail.readUInt16LE(eocd + 10);
  const dirSize = tail.readUInt32LE(eocd + 12);
  const dirOffset = tail.readUInt32LE(eocd + 16);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    fail("zip64 archives aren't supported");
  }
  if (dirOffset + dirSize > tailStart + eocd) fail('the central directory runs past its end');

  const dir = readAt(fd, dirOffset, dirSize, path);
  const entries = new Map<string, ZipEntry>();
  let off = 0;
  for (let i = 0; i < count; i++) {
    if (off + 46 > dir.length || dir.readUInt32LE(off) !== CENTRAL_SIGNATURE) {
      fail(`central directory entry ${i} is damaged`);
    }
    const flags = dir.readUInt16LE(off + 8);
    const method = dir.readUInt16LE(off + 10);
    const crc = dir.readUInt32LE(off + 16);
    const compressedSize = dir.readUInt32LE(off + 20);
    const size = dir.readUInt32LE(off + 24);
    const nameLength = dir.readUInt16LE(off + 28);
    const extraLength = dir.readUInt16LE(off + 30);
    const commentLength = dir.readUInt16LE(off + 32);
    const localOffset = dir.readUInt32LE(off + 42);
    // Bit 11: the name is UTF-8. Otherwise it's CP437, which matches latin1 for ASCII names.
    const name = dir.toString(flags & 0x800 ? 'utf8' : 'latin1', off + 46, off + 46 + nameLength);
    off += 46 + nameLength + extraLength + commentLength;
    if (compressedSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
      fail(`${name} needs zip64, which isn't supported`);
    }
    if (name.endsWith('/')) continue; // a directory
    if (entries.has(name)) fail(`${name} appears twice`);
    entries.set(name, { name, method, flags, crc, compressedSize, size, localOffset });
  }

  let open = true;
  return {
    path,
    entries,
    read(name: string): Buffer {
      if (!open) throw new Error(`${path}: already closed`);
      const entry = entries.get(name);
      if (!entry) throw new Error(`${path} has no file ${name}`);
      const where = `${path}: ${name}`;
      if (entry.flags & 0x1) throw new Error(`${where} is encrypted`);
      const local = readAt(fd, entry.localOffset, 30, path);
      if (local.readUInt32LE(0) !== LOCAL_SIGNATURE) {
        throw new Error(`${where} has a damaged local header`);
      }
      // The local header's own name and extra field lengths can differ from the directory's.
      const start = entry.localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const stored = readAt(fd, start, entry.compressedSize, path);
      let data: Buffer;
      if (entry.method === 0) {
        data = stored;
      } else if (entry.method === 8) {
        data = inflateRawSync(stored);
      } else {
        throw new Error(
          `${where} uses compression method ${entry.method} (only Stored and Deflate)`,
        );
      }
      if (data.length !== entry.size) {
        throw new Error(`${where} is ${data.length} bytes; the directory says ${entry.size}`);
      }
      if (crc32(data) !== entry.crc) throw new Error(`${where} fails its CRC-32 check`);
      return data;
    },
    close(): void {
      if (open) closeSync(fd);
      open = false;
    },
  };
}
