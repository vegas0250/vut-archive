const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

export const ARCHIVE_BYTE_LIMIT = 256 * 1024 * 1024;

export interface ZipMember {
  name: string;
  size: number;
  compressedSize: number;
  directory: boolean;
  method: number;
}

export interface ArchiveListing {
  path: string;
  members: ZipMember[];
}

function findEocd(data: Uint8Array): number {
  const start = Math.max(0, data.length - (22 + 0xffff));
  for (let offset = data.length - 22; offset >= start; offset -= 1) {
    if (
      data[offset] === 0x50 &&
      data[offset + 1] === 0x4b &&
      data[offset + 2] === 0x05 &&
      data[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

export function listZip(data: Uint8Array): ZipMember[] {
  if (data.byteLength < 22) throw new Error('Файл не похож на ZIP');
  const eocd = findEocd(data);
  if (eocd < 0) throw new Error('Не удалось прочитать каталог ZIP');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(eocd, true) !== EOCD) throw new Error('Не удалось прочитать каталог ZIP');
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff || view.getUint32(eocd + 12, true) === 0xffffffff) {
    throw new Error('ZIP64 пока не поддерживается');
  }
  const members: ZipMember[] = [];
  let cursor = offset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > data.length || view.getUint32(cursor, true) !== CENTRAL) {
      throw new Error('Повреждённый ZIP');
    }
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const name = new TextDecoder('utf-8').decode(data.subarray(cursor + 46, cursor + 46 + nameLength));
    members.push({
      name,
      size,
      compressedSize,
      directory: name.endsWith('/'),
      method,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return members;
}

export function entryParts(name: string): string[] {
  const normalized = name.replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error(`Небезопасный путь в архиве: ${name}`);
  }
  const parts = normalized.split('/').filter((part) => part.length > 0);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`Небезопасный путь в архиве: ${name}`);
  }
  return parts;
}
