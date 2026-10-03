import { contextBridge, ipcRenderer } from 'electron';
import type { ArchiveListing } from '../shared/zip';
import { channels, type Result } from '../shared/ipc';

const api = {
  pick: (kind: 'open' | 'save' | 'directory' | 'sources'): Promise<Result<string | string[] | null>> =>
    ipcRenderer.invoke(channels.pick, kind),
  open: (file: string): Promise<Result<ArchiveListing>> => ipcRenderer.invoke(channels.open, file),
  extract: (file: string, destination: string, names: string[] | null): Promise<Result<number>> =>
    ipcRenderer.invoke(channels.extract, file, destination, names),
  create: (destination: string, sources: string[]): Promise<Result<string>> =>
    ipcRenderer.invoke(channels.create, destination, sources),
};

contextBridge.exposeInMainWorld('archive', api);

export type ArchiveApi = typeof api;
