import './styles.css';
import 'vui/shell';
import 'vui/toolbar';
import 'vui/status-bar';
import 'vui/data-grid';
import 'vui/button';
import 'vui/empty';
import 'vui/text';
import 'vui/menu';
import 'vui/icon';
import { setDensity } from 'vui/theme';
import type { VButton } from 'vui/button';
import type { VDataGrid, VDataGridRow } from 'vui/data-grid';
import type { VMenu } from 'vui/menu';
import { mountChrome, restoreTheme } from './chrome';
import { formatSize } from './format';
import type { Result } from '../shared/ipc';
import type { ArchiveListing } from '../shared/zip';

restoreTheme();
setDensity('compact');

const root = document.querySelector('#app');
if (!root) throw new Error('Не найдено окно приложения');
mountChrome(root);

const shell = document.createElement('vui-shell');
shell.setAttribute('label', 'Archive');
shell.setAttribute('skip-label', 'К содержимому архива');

const toolbar = document.createElement('vui-toolbar');
toolbar.setAttribute('slot', 'toolbar');
toolbar.setAttribute('label', 'Команды');

function button(label: string, icon: string): VButton {
  const element = document.createElement('vui-button') as VButton;
  element.setAttribute('variant', 'ghost');
  element.setAttribute('size', 'small');
  const mark = document.createElement('vui-icon');
  mark.setAttribute('slot', 'icon');
  mark.setAttribute('name', icon);
  element.append(mark, document.createTextNode(label));
  return element;
}

const openButton = button('Открыть', 'folder-open');
const extractButton = button('Извлечь', 'folder');
const createButton = button('Создать', 'file-archive');
toolbar.append(openButton, extractButton, createButton);

const stage = document.createElement('div');
stage.className = 'stage';
const empty = document.createElement('vui-empty');
empty.setAttribute('heading', 'Нет архива');
empty.setAttribute('label', 'Откройте ZIP или создайте новый');
const grid = document.createElement('vui-data-grid') as VDataGrid;
grid.setAttribute('label', 'Содержимое архива');
grid.setAttribute('empty-label', 'Архив пуст');
grid.multiple = true;
grid.fill = true;
grid.hidden = true;
grid.columns = [
  { key: 'name', title: 'Имя', iconKey: 'icon' },
  { key: 'kind', title: 'Тип', priority: 'secondary' },
  { key: 'size', title: 'Размер', align: 'end', priority: 'secondary' },
  { key: 'compressed', title: 'Сжатый', align: 'end', priority: 'secondary' },
];
stage.append(empty, grid);

const status = document.createElement('vui-status-bar');
status.setAttribute('slot', 'footer');
status.setAttribute('label', 'Состояние');
const statusMain = document.createElement('span');
statusMain.textContent = 'ZIP';
const statusEnd = document.createElement('span');
statusEnd.setAttribute('slot', 'end');
status.append(statusMain, statusEnd);

const fileMenu = document.createElement('vui-menu') as VMenu;
fileMenu.setAttribute('label', 'Запись');
const extractItem = document.createElement('vui-menu-item');
extractItem.setAttribute('label', 'Извлечь');
extractItem.setAttribute('icon', 'folder');
fileMenu.append(extractItem);
extractItem.addEventListener('click', () => extractButton.click());
grid.addEventListener(
  'contextmenu',
  (event) => {
    const row = event.composedPath().find((node): node is HTMLElement => node instanceof HTMLElement && node.getAttribute('role') === 'row');
    const id = row?.dataset.id;
    if (id && !grid.selectedIds.includes(id)) grid.selectedIds = [id];
  },
  true,
);
fileMenu.bindTo(grid);

shell.append(toolbar, stage, status, fileMenu);
root.append(shell);

let current: ArchiveListing | null = null;
let busy = false;

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

function sync(): void {
  openButton.disabled = busy;
  createButton.disabled = busy;
  extractButton.disabled = busy || !current;
}

function showListing(listing: ArchiveListing): void {
  current = listing;
  const rows: VDataGridRow[] = listing.members.map((member) => ({
    id: member.name,
    icon: member.directory ? 'folder' : 'file-archive',
    name: member.name,
    kind: member.directory ? 'Каталог' : 'Файл',
    size: member.directory ? '' : formatSize(member.size),
    compressed: member.directory ? '' : formatSize(member.compressedSize),
  }));
  grid.rows = rows;
  grid.hidden = false;
  empty.hidden = true;
  statusMain.textContent = `${listing.members.length} записей`;
  statusEnd.textContent = listing.path;
  sync();
}

function fail(error: unknown): void {
  statusMain.textContent = error instanceof Error ? error.message : 'Операция не выполнена';
}

async function choose(kind: 'open' | 'save' | 'directory' | 'sources'): Promise<string | string[] | null> {
  const picked = unwrap(await window.archive.pick(kind));
  return picked;
}

openButton.addEventListener('click', () => {
  void (async () => {
    try {
      busy = true;
      sync();
      const picked = await choose('open');
      if (typeof picked !== 'string') return;
      showListing(unwrap(await window.archive.open(picked)));
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      sync();
    }
  })();
});

extractButton.addEventListener('click', () => {
  if (!current) return;
  void (async () => {
    const archive = current;
    if (!archive) return;
    try {
      busy = true;
      sync();
      const destination = await choose('directory');
      if (typeof destination !== 'string') return;
      const names = grid.selectedIds.length ? grid.selectedIds : null;
      const count = unwrap(await window.archive.extract(archive.path, destination, names));
      statusMain.textContent = `Извлечено файлов: ${count}`;
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      sync();
    }
  })();
});

createButton.addEventListener('click', () => {
  void (async () => {
    try {
      busy = true;
      sync();
      const sources = await choose('sources');
      if (!Array.isArray(sources) || sources.length === 0) return;
      const destination = await choose('save');
      if (typeof destination !== 'string') return;
      const created = unwrap(await window.archive.create(destination, sources));
      showListing(unwrap(await window.archive.open(created)));
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      sync();
    }
  })();
});

sync();
