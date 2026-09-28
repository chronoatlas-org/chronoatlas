import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readZipEntry } from './zip.ts';

/** A minimal zip archive (the reader ignores CRCs, dates, and versions). */
function zip(files: { name: string; data: string; store?: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const raw = Buffer.from(file.data);
    const body = file.store ? raw : deflateRawSync(raw);
    const name = Buffer.from(file.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(file.store ? 0 : 8, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(file.store ? 0 : 8, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    directory.push(entry, name);
    offset += 30 + name.length + body.length;
  }
  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

describe('readZipEntry', () => {
  const archive = zip([
    { name: 'first.txt', data: 'x'.repeat(1000) },
    { name: 'testland/wanted.json', data: '{"testland":true}' },
    { name: 'stored.txt', data: 'not compressed', store: true },
  ]);

  it('finds compressed and stored files by name', () => {
    expect(readZipEntry(archive, 'testland/wanted.json')?.toString()).toBe('{"testland":true}');
    expect(readZipEntry(archive, 'first.txt')?.length).toBe(1000);
    expect(readZipEntry(archive, 'stored.txt')?.toString()).toBe('not compressed');
  });

  it('returns null for a missing file, and refuses something that is not a zip', () => {
    expect(readZipEntry(archive, 'missing.txt')).toBeNull();
    expect(() => readZipEntry(Buffer.from('not a zip at all, just some text that is long enough'), 'x')).toThrow(/not a zip/);
  });
});
