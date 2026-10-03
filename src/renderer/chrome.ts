import 'vui/titlebar';
import 'vui/icon';
import 'vui/icon-button';
import 'vui/menu';
import { getTheme, setTheme, type VuiTheme } from 'vui/theme';
import type { VMenu } from 'vui/menu';

const storageKey = 'vut-theme';

const themes: Array<[VuiTheme, string]> = [
  ['neon-green', 'Неон: зелёный'],
  ['neon-magenta', 'Неон: пурпурный'],
  ['neon-cyan', 'Неон: бирюзовый'],
  ['dark', 'Тёмная'],
  ['light', 'Светлая'],
  ['high-contrast', 'Контрастная'],
  ['system', 'Системная'],
];

export function restoreTheme(): void {
  const stored = localStorage.getItem(storageKey);
  const known = themes.some(([theme]) => theme === stored);
  setTheme(known ? (stored as VuiTheme) : 'neon-green');
}

export function mountChrome(parent: Element): void {
  const bar = document.createElement('vui-titlebar');
  bar.setAttribute('label', 'Archive');
  bar.setAttribute('minimize-label', 'Свернуть');
  bar.setAttribute('maximize-label', 'Развернуть');
  bar.setAttribute('restore-label', 'Восстановить');
  bar.setAttribute('close-label', 'Закрыть');

  const mark = document.createElement('vui-icon');
  mark.setAttribute('slot', 'icon');
  mark.setAttribute('name', 'file-archive');

  const themeButton = document.createElement('vui-icon-button');
  themeButton.setAttribute('slot', 'tools');
  themeButton.setAttribute('name', 'palette');
  themeButton.setAttribute('label', 'Тема');
  themeButton.setAttribute('variant', 'ghost');
  themeButton.setAttribute('size', 'small');

  const menu = document.createElement('vui-menu') as VMenu;
  menu.setAttribute('label', 'Тема');
  for (const [theme, label] of themes) {
    const item = document.createElement('vui-menu-item');
    item.setAttribute('label', label);
    item.setAttribute('icon', 'palette');
    if (getTheme() === theme) item.setAttribute('checked', '');
    item.addEventListener('click', () => {
      setTheme(theme);
      localStorage.setItem(storageKey, theme);
      menu.querySelectorAll('vui-menu-item').forEach((node) => node.removeAttribute('checked'));
      item.setAttribute('checked', '');
    });
    menu.append(item);
  }
  themeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const rect = themeButton.getBoundingClientRect();
    menu.showAt(rect.left, rect.bottom);
  });
  bar.addEventListener('minimize', () => window.archive.minimize());
  bar.addEventListener('maximize', () => window.archive.toggleMaximize());
  bar.addEventListener('close', () => window.archive.close());
  window.archive.onMaximized((maximized) => bar.toggleAttribute('maximized', maximized));
  bar.append(mark, themeButton);
  parent.append(bar);
  document.body.append(menu);
}
