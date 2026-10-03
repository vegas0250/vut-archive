import { lstat, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { ARCHIVE_BYTE_LIMIT, entryParts, listZip, type ArchiveListing } from '../../shared/zip';

function absolutePath(input: unknown): string {
  if (typeof input !== 'string' || input.length === 0 || input.includes('\0')) {
    throw new Error('Недопустимый путь');
  }
  return path.resolve(input);
}

async function readBounded(file: string): Promise<Uint8Array> {
  const info = await stat(file);
  if (!info.isFile()) throw new Error('Ожидался файл архива');
  if (info.size > ARCHIVE_BYTE_LIMIT) throw new Error('Архив больше 256 МБ. Эта версия держит его в памяти целиком');
  return new Uint8Array(await readFile(file));
}

function assertInside(root: string, target: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Небезопасный путь в архиве');
  }
}

export async function openArchive(input: unknown): Promise<ArchiveListing> {
  const file = absolutePath(input);
  if (!file.toLowerCase().endsWith('.zip')) throw new Error('Поддерживается только ZIP');
  const data = await readBounded(file);
  const members = listZip(data);
  const unpacked = members.reduce((sum, member) => sum + member.size, 0);
  if (unpacked > ARCHIVE_BYTE_LIMIT) throw new Error('Распакованный размер превышает 256 МБ');
  return { path: file, members };
}

export async function extractArchive(archiveInput: unknown, destinationInput: unknown, names: unknown): Promise<number> {
  const archive = absolutePath(archiveInput);
  const destination = absolutePath(destinationInput);
  if (!archive.toLowerCase().endsWith('.zip')) throw new Error('Поддерживается только ZIP');
  const data = await readBounded(archive);
  const members = listZip(data);
  const unpacked = members.reduce((sum, member) => sum + member.size, 0);
  if (unpacked > ARCHIVE_BYTE_LIMIT) throw new Error('Распакованный размер превышает 256 МБ');
  const wanted = Array.isArray(names) ? new Set(names.filter((name): name is string => typeof name === 'string')) : null;
  const selected = members.filter((member) => !wanted || wanted.has(member.name));
  if (selected.length === 0) throw new Error('Нечего извлекать');
  if (selected.some((member) => member.method !== 0 && member.method !== 8)) {
    throw new Error('Метод сжатия не поддерживается');
  }
  const decoded = unzipSync(data);
  let files = 0;
  for (const member of selected) {
    const parts = entryParts(member.name);
    if (parts.length === 0) continue;
    const target = path.resolve(destination, ...parts);
    assertInside(destination, target);
    if (member.directory) {
      await mkdir(target, { recursive: true });
      continue;
    }
    const bytes = decoded[member.name];
    if (!bytes) throw new Error(`В архиве нет данных: ${member.name}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    files += 1;
  }
  return files;
}

async function collect(
  source: string,
  entryName: string,
  files: Record<string, Uint8Array>,
  budget: { left: number },
): Promise<void> {
  const info = await lstat(source);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    if (entryName) files[entryName.endsWith('/') ? entryName : `${entryName}/`] = new Uint8Array();
    for (const child of await readdir(source)) {
      const next = entryName ? `${entryName.replace(/\/$/, '')}/${child}` : child;
      await collect(path.join(source, child), next, files, budget);
    }
    return;
  }
  if (!info.isFile()) return;
  if (info.size > budget.left) throw new Error('Исходные файлы больше 256 МБ');
  const data = new Uint8Array(await readFile(source));
  budget.left -= data.byteLength;
  files[entryName.replaceAll('\\', '/')] = data;
}

export async function createArchive(destinationInput: unknown, sourcesInput: unknown): Promise<string> {
  if (!Array.isArray(sourcesInput) || sourcesInput.length === 0 || sourcesInput.some((item) => typeof item !== 'string')) {
    throw new Error('Не выбраны файлы');
  }
  const resolved = absolutePath(destinationInput);
  const destination = resolved.toLowerCase().endsWith('.zip') ? resolved : `${resolved}.zip`;
  const files: Record<string, Uint8Array> = {};
  const budget = { left: ARCHIVE_BYTE_LIMIT };
  for (const source of sourcesInput) {
    const file = absolutePath(source);
    await collect(file, path.basename(file), files, budget);
  }
  if (Object.keys(files).length === 0) throw new Error('Нет файлов для архива');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, zipSync(files, { level: 6 }));
  return destination;
}
