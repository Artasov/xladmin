# xladmin

`xladmin` это React + MUI frontend-пакет для admin UI поверх backend-пакета `xladmin`.

Важно:

- имя пакета в npm: `xladmin`
- импорт во frontend: `from 'xladmin'`
- исходники монорепы: [Artasov/xladmin](https://github.com/Artasov/xladmin)

## Что есть в библиотеке

- transport-agnostic `XLAdminClient`
- helpers для `axios` и `fetch`
- `Shell`, `OverviewPage`, `ModelPage`, `ObjectPage`
- `ModelsBlocks`, `FieldEditor`, `FormDialog`
- встроенный RU / EN i18n
- right sidebar list filters from backend `list_filters`
- форматирование `date` и `datetime`
- форматирование и редактирование `JSON` полей
- ширины колонок списка через `FieldConfig.width_px`
- обрезка длинных текстов в list-view
- delete preview dialog перед single delete и bulk delete
- сохранение раскрытости `ModelsBlocks` в `localStorage`
- встроенная MUI theme `defaultAdminTheme`

Короткие имена считаются основными. Старые `Admin*` имена оставлены как alias для совместимости.

## Основной API

- `createXLAdminClient(...)`
- `createAxiosXLAdminClient(...)`
- `createFetchXLAdminClient(...)`
- `Shell`
- `OverviewPage`
- `ModelPage`
- `ObjectPage`
- `ModelsBlocks`
- `DeletePreviewDialog`
- `defaultAdminTheme`

## Совместимость

- `React >=19,<20`
- `React DOM >=19,<20`
- `Next >=15,<17`
- `@mui/material >=7,<8`
- `@mui/icons-material >=7,<8`
- `@mui/x-date-pickers >=8,<9`
- `dayjs >=1,<2`
- `axios >=1,<2` — опционально, только если проект использует axios-helper

## Как подключать

Библиотека не требует именно `axios`.

Можно использовать:

- `createAxiosXLAdminClient(api)` — если проект уже живёт на `axios instance`
- `createFetchXLAdminClient({...})` — если проект работает через `fetch`
- свой `XLAdminClient` — если проекту нужен полностью свой transport

Практическая интеграция вынесена в [docs/HOW_TO_USE.md](docs/HOW_TO_USE.md).
