export function formatSize(size: number): string {
  if (size < 1024) return `${size} Б`;
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
