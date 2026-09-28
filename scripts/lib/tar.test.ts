import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readTarGzEntry } from './tar.ts';

/** A minimal tar archive (enough for the reader, which ignores checksums and permissions). */
function tarGz(files: { name: string; data: string; prefix?: string }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const file of files) {
    const header = Buffer.alloc(512);
    header.write(file.name, 0, 'utf8');
    header.write(Buffer.byteLength(file.data).toString(8).padStart(11, '0') + '\0', 124, 'latin1');
    header.write('ustar\0', 257, 'latin1');
    if (file.prefix) header.write(file.prefix, 345, 'utf8');
    const data = Buffer.from(file.data);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

describe('readTarGzEntry', () => {
  const archive = tarGz([
    { name: 'first.txt', data: 'x'.repeat(600) }, // spans two blocks
    { name: 'wanted.json', prefix: 'testland/inst', data: '{"testland":true}' },
  ]);

  it('finds a file after others, joining a POSIX prefix and name', () => {
    expect(readTarGzEntry(archive, 'testland/inst/wanted.json')?.toString()).toBe('{"testland":true}');
    expect(readTarGzEntry(archive, 'first.txt')?.length).toBe(600);
  });

  it('returns null for a file that is not there', () => {
    expect(readTarGzEntry(archive, 'missing.txt')).toBeNull();
  });
});
