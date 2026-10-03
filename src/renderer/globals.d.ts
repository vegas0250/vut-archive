import type { ArchiveApi } from '../preload/index';

declare global {
  interface Window {
    archive: ArchiveApi;
  }
}

export {};
