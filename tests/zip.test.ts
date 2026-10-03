import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createArchive, extractArchive, openArchive } from '../src/main/archive/service';
import { entryParts, listZip } from '../src/shared/zip';

describe('zip catalog', () => {
  it('reads names and sizes without treating a traversal path as safe', () => {
    const zipped = zipSync({ 'notes/a.txt': strToU8('hello'), 'b.txt': strToU8('x') });
    const members = listZip(zipped);
    expect(members.map((member) => member.name).sort()).toEqual(['b.txt', 'notes/a.txt']);
    expect(members.find((member) => member.name === 'b.txt')?.size).toBe(1);
    expect(entryParts('notes/a.txt')).toEqual(['notes', 'a.txt']);
    expect(() => entryParts('../secret')).toThrow(/Небезопасный путь/);
    expect(() => entryParts('/etc/passwd')).toThrow(/Небезопасный путь/);
  });
});

describe('archive service', () => {
  it('creates a zip, lists it, and extracts one entry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'archive-'));
    try {
      const source = path.join(root, 'note.txt');
      await writeFile(source, 'vegas');
      const archive = await createArchive(path.join(root, 'pack'), [source]);
      expect(archive.endsWith('.zip')).toBe(true);
      const listing = await openArchive(archive);
      expect(listing.members.map((member) => member.name)).toEqual(['note.txt']);
      const destination = path.join(root, 'out');
      const count = await extractArchive(archive, destination, ['note.txt']);
      expect(count).toBe(1);
      expect(await readFile(path.join(destination, 'note.txt'), 'utf8')).toBe('vegas');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
