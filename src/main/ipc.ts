import type { Dialog } from 'electron';
import { ipcMain } from 'electron';
import { createArchive, extractArchive, openArchive } from './archive/service';
import { channels, failure, type Result } from '../shared/ipc';

async function guard<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    console.error(error);
    return failure(error);
  }
}

async function pick(dialog: Dialog, kind: 'open' | 'save' | 'directory' | 'sources'): Promise<string | string[] | null> {
  if (kind === 'save') {
    const result = await dialog.showSaveDialog({
      title: 'Сохранить архив',
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    });
    return result.canceled || !result.filePath ? null : result.filePath;
  }
  const result = await dialog.showOpenDialog({
    title: kind === 'directory' ? 'Куда извлечь' : kind === 'sources' ? 'Файлы для архива' : 'Открыть архив',
    properties:
      kind === 'directory' ? ['openDirectory'] : kind === 'sources' ? ['openFile', 'openDirectory', 'multiSelections'] : ['openFile'],
    filters: kind === 'open' ? [{ name: 'ZIP', extensions: ['zip'] }] : [],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return kind === 'sources' ? result.filePaths : (result.filePaths[0] ?? null);
}

export function registerIpc(dialog: Dialog): void {
  ipcMain.handle(channels.pick, (_event, kind: unknown) => {
    if (kind !== 'open' && kind !== 'save' && kind !== 'directory' && kind !== 'sources') {
      return Promise.resolve(failure(new Error('Неизвестный диалог')));
    }
    return guard(() => pick(dialog, kind));
  });
  ipcMain.handle(channels.open, (_event, file: unknown) => guard(() => openArchive(file)));
  ipcMain.handle(channels.extract, (_event, file: unknown, destination: unknown, names: unknown) =>
    guard(() => extractArchive(file, destination, names)),
  );
  ipcMain.handle(channels.create, (_event, destination: unknown, sources: unknown) =>
    guard(() => createArchive(destination, sources)),
  );
}
