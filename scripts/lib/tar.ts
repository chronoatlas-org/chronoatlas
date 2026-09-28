// Reads one file out of a .tar.gz archive, for import scripts. Node can un-gzip but has no tar
// reader, and the format is simple: each file is a 512-byte header followed by its data, padded
// to a multiple of 512 bytes. Two all-zero blocks end the archive.

import { gunzipSync } from 'node:zlib';

/** The contents of the file at `path` inside a .tar.gz archive, or null if it isn't there. */
export function readTarGzEntry(archive: Buffer, path: string): Buffer | null {
  const tar = gunzipSync(archive);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) =>
      header.subarray(start, start + length).toString('utf8').split('\0')[0];
    // POSIX ("ustar\0") headers may split a long path into a prefix and a name.
    const posix = header.subarray(257, 263).toString('latin1') === 'ustar\0';
    const prefix = posix ? field(345, 155) : '';
    const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12).trim() || '0', 8);
    const start = offset + 512;
    if (name === path) return Buffer.from(tar.subarray(start, start + size));
    offset = start + Math.ceil(size / 512) * 512;
  }
  return null;
}
