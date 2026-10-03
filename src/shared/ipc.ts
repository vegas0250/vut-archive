export const channels = {
  pick: 'archive:pick',
  open: 'archive:open',
  extract: 'archive:extract',
  create: 'archive:create',
} as const;

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export function failure(error: unknown): Result<never> {
  return { ok: false, message: error instanceof Error ? error.message : 'Неизвестная ошибка' };
}
