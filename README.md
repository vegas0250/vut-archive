# Archive

Archive — отдельный инструмент VUT для архивов. Первая версия открывает, создаёт и извлекает ZIP. Это не экран внутри Vortex и не вторая UI-система.

```text
VUI           внешний вид
  ↓
VUT Archive   каталог ZIP, извлечение, создание
  ↓
Electron      окно, диалоги файлов, IPC
```

Общий интерфейс только через пакет `vui`. Vortex этот репозиторий не импортирует, и Archive не импортирует Vortex. Позже Vortex сможет вызвать Archive как отдельную возможность, не копируя его код внутрь файлового менеджера.

## Разработка

Рядом нужен собранный `vui`.

```bash
pnpm install
pnpm dev
```

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`lint` — строгая проверка TypeScript.

## Production

```bash
pnpm package:win
pnpm package:linux
pnpm package
```

Windows x64 — zip. Linux x64 — tar.gz. `fflate` вшивается в main-процесс. В пакет не кладутся исходники, тесты, source maps и `node_modules`: `scripts/before-build.cjs` возвращает `false`, и electron-builder не копирует зависимости поверх уже собранных бандлов.

Архив целиком читается в память. Предел этой версии — 256 МБ сжатого файла и столько же суммарного распакованного размера. ZIP64 и методы кроме Store и Deflate не поддерживаются. Символические ссылки в создаваемый архив не входят.

## Структура

```text
src/main/archive   ZIP: каталог, извлечение, создание
src/main           окно и IPC
src/preload        contextBridge
src/renderer       оболочка VUI
src/shared         разбор центрального каталога ZIP без распаковки
```

Граница слоёв — в [ARCHITECTURE.md](ARCHITECTURE.md).
