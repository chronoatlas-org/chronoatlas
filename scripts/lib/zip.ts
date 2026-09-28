// Reads one file out of a .zip archive, for import scripts. Node can inflate ("un-deflate") data
// but has no zip reader. A zip file ends with a central directory that lists every file, with its
// sizes and where its data starts, which is all this needs. (No ZIP64: files over 4 GB aren't
// supported.)

import { inflateRawSync } from 'node:zlib';

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/** The contents of the file named `name` inside a zip archive, or null if it isn't there. */
export function readZipEntry(archive: Buffer, name: string): Buffer | null {
  // The end-of-directory record is in the last 64 KB (it may be followed by a comment).
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65_557); i--) {
    if (archive.readUInt32LE(i) === END_OF_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip file (no end-of-directory record)');
  const count = archive.readUInt16LE(end + 10);
  let p = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(p) !== DIRECTORY_ENTRY) throw new Error('damaged zip directory');
    const method = archive.readUInt16LE(p + 10);
    const compressedSize = archive.readUInt32LE(p + 20);
    const size = archive.readUInt32LE(p + 24);
    const nameLength = archive.readUInt16LE(p + 28);
    const extraLength = archive.readUInt16LE(p + 30);
    const commentLength = archive.readUInt16LE(p + 32);
    const localOffset = archive.readUInt32LE(p + 42);
    const entryName = archive.toString('utf8', p + 46, p + 46 + nameLength);
    if (entryName === name) {
      if (archive.readUInt32LE(localOffset) !== LOCAL_HEADER) throw new Error('damaged zip entry');
      const start = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
      const data = archive.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method !== 8) throw new Error(`unsupported zip compression method ${method}`);
      const inflated = inflateRawSync(data);
      if (inflated.length !== size) throw new Error(`${name}: unpacked ${inflated.length} bytes, expected ${size}`);
      return inflated;
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}
