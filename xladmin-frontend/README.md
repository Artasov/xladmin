# xladmin

`xladmin` это React/MUI-библиотека для admin UI поверх backend-пакета `xladmin`.

Важно:

- имя пакета в npm: `xladmin`
- импорты во frontend: `from 'xladmin'`

## Что есть в библиотеке

- `createXLAdminClient(...)` — сборка клиента из любого совместимого transport-объекта
- `createAxiosXLAdminClient(...)` — готовый helper для `axios`
- `createFetchXLAdminClient(...)` — готовый helper для `fetch`
- `AdminShell` — общий layout админки
- `AdminHome` — главная страница со списком моделей
- `AdminModelPage` — список объектов модели
- `AdminObjectPage` — детальная страница объекта
- `defaultAdminTheme` — встроенная тема библиотеки

Основные файлы:

- `src/client.ts`
- `src/components/AdminShell.tsx`
- `src/components/AdminModelPage.tsx`
- `src/components/AdminObjectPage.tsx`
- `src/components/AdminFieldEditor.tsx`
- `src/theme/defaultAdminTheme.ts`

## Совместимость

- `React >=19,<20`
- `React DOM >=19,<20`
- `Next >=15,<17`
- `@mui/material >=7,<8`
- `@mui/icons-material >=7,<8`
- `@mui/x-date-pickers >=8,<9`
- `dayjs >=1,<2`
- `axios >=1,<2` — опционально, только если проект хочет использовать axios-helper

## Как подключать

Библиотека не требует именно `axios`.

Можно использовать:

- `createAxiosXLAdminClient(api)` если у проекта уже есть `axios instance`
- `createFetchXLAdminClient({...})` если проект работает через `fetch`
- свой `XLAdminClient`, если проекту нужен полностью свой transport или особая логика

Практическая инструкция вынесена в [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md).
