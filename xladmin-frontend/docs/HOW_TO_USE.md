# HOW TO USE

## 1. Быстрое подключение

Frontend-библиотека ждёт не “проектный API”, а клиент, совместимый с контрактом `XLAdminClient`.

Самые частые варианты:

### Axios

```tsx
'use client';

import {useMemo} from 'react';
import {OverviewPage, Shell, createAxiosXLAdminClient} from 'xladmin';
import {api} from '@/modules/Api/client';


export function XLAdminHomePageClient({
    models,
    blocks,
    locale,
}: {
    models: [];
    blocks: [];
    locale: 'ru' | 'en';
}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale={locale}>
            <OverviewPage basePath="/admin" models={models} blocks={blocks} locale={locale} />
        </Shell>
    );
}
```

### Fetch

```tsx
'use client';

import {useMemo} from 'react';
import {OverviewPage, Shell, createFetchXLAdminClient} from 'xladmin';


export function XLAdminHomePageClient({
    models,
    blocks,
    locale,
}: {
    models: [];
    blocks: [];
    locale: 'ru' | 'en';
}) {
    const client = useMemo(() => createFetchXLAdminClient({
        baseUrl: '/api/v1',
        credentials: 'include',
        headers: () => ({
            'X-CSRFToken': window.localStorage.getItem('csrf') ?? '',
        }),
    }), []);

    return (
        <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale={locale}>
            <OverviewPage basePath="/admin" models={models} blocks={blocks} locale={locale} />
        </Shell>
    );
}
```

### Свой XLAdminClient

```tsx
import type {XLAdminClient} from 'xladmin';


const client: XLAdminClient = {
    getModels: async () => ({locale: 'ru', items: [], blocks: []}),
    getModel: async (slug) => fetchModelSomehow(slug),
    getItems: async (slug, params) => fetchItemsSomehow(slug, params),
    getItem: async (slug, id) => fetchItemSomehow(slug, id),
    createItem: async (slug, payload) => createItemSomehow(slug, payload),
    patchItem: async (slug, id, payload) => patchItemSomehow(slug, id, payload),
    deleteItem: async (slug, id) => deleteItemSomehow(slug, id),
    getDeletePreview: async (slug, id) => fetchDeletePreviewSomehow(slug, id),
    bulkDelete: async (slug, ids) => bulkDeleteSomehow(slug, ids),
    getBulkDeletePreview: async (slug, ids) => fetchBulkDeletePreviewSomehow(slug, ids),
    runBulkAction: async (slug, actionSlug, ids, payload) => runBulkActionSomehow(slug, actionSlug, ids, payload),
    runObjectAction: async (slug, id, actionSlug, payload) => runObjectActionSomehow(slug, id, actionSlug, payload),
    getChoices: async (slug, fieldName, q, ids) => fetchChoicesSomehow(slug, fieldName, q, ids),
};
```

## 2. Нормальная интеграция в проект

Обычно проект делает маленькие client-wrapper компоненты, а не использует библиотечные компоненты прямо в `app`.

```tsx
'use client';

import {useMemo} from 'react';
import {
    ModelPage,
    ObjectPage,
    OverviewPage,
    Shell,
    createAxiosXLAdminClient,
    type AdminLocale,
    type AdminModelMeta,
    type AdminModelsBlockMeta,
} from 'xladmin';

import {api} from '@/modules/Api/client';


type XLAdminShellProps = {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    locale: AdminLocale;
    children: React.ReactNode;
};


function XLAdminShellRoot({models, blocks, locale, children}: XLAdminShellProps) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <Shell
            client={client}
            models={models}
            blocks={blocks}
            basePath="/ru/admin"
            locale={locale}
        >
            {children}
        </Shell>
    );
}


export function XLAdminHomePageClient({
    models,
    blocks,
    locale,
}: {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    locale: AdminLocale;
}) {
    return (
        <XLAdminShellRoot models={models} blocks={blocks} locale={locale}>
            <OverviewPage basePath="/ru/admin" models={models} blocks={blocks} locale={locale} />
        </XLAdminShellRoot>
    );
}


export function XLAdminModelPageClient({
    models,
    blocks,
    slug,
    locale,
}: {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    slug: string;
    locale: AdminLocale;
}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <XLAdminShellRoot models={models} blocks={blocks} locale={locale}>
            <ModelPage client={client} basePath="/ru/admin" slug={slug} />
        </XLAdminShellRoot>
    );
}


export function XLAdminObjectPageClient({
    models,
    blocks,
    slug,
    id,
    locale,
}: {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    slug: string;
    id: string;
    locale: AdminLocale;
}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <XLAdminShellRoot models={models} blocks={blocks} locale={locale}>
            <ObjectPage client={client} slug={slug} id={id} />
        </XLAdminShellRoot>
    );
}
```

## 3. Что делает frontend сам

`ModelPage`

- показывает список объектов
- держит `q`, `sort`, `page` и `list_filters` в query params
- поддерживает поиск, сортировку, компактные фильтры и постраничную навигацию
- показывает bulk actions через меню `Actions`
- показывает delete preview перед bulk delete
- показывает skeleton только для таблицы при перезагрузке списка

`ObjectPage`

- открывает конкретный объект
- даёт inline-редактирование
- показывает справа панель действий
- показывает `Save` только если форма реально изменилась
- показывает delete preview перед удалением объекта
- показывает object actions из backend-конфига

`FieldEditor`

- `boolean` -> `Switch`
- `date` -> `DatePicker`
- `datetime` -> `DateTimePicker`
- `json` -> multiline `TextField` с валидацией JSON
- relation -> `Autocomplete`
- обычные поля -> `TextField`

`ModelsBlocks`

- строит overview и sidebar blocks из backend meta
- поддерживает `collapsible`, `default_expanded` и `color`
- сохраняет последнее состояние аккордеонов в `localStorage`

## 4. Locale и форматирование

Библиотека поддерживает `ru` и `en`.

Что локализовано:

- встроенные UI label и сообщения
- delete preview dialog
- overview / all models
- yes / no
- loading / saving / deleting

`date` и `datetime` форматируются через `Intl` по текущему locale.

Если backend отдал `locale="en"`, frontend автоматически покажет английские встроенные тексты и формат дат.

`JSON`-значения в detail/read-only режиме показываются как форматированный JSON, а не как `[object Object]`.

## 4.2. List filters

Если backend отдал `meta.list_filters`, `ModelPage` автоматически строит отдельную правую панель фильтров внутри страницы модели.

Что делает frontend:

- хранит значения фильтров в query params
- сбрасывает пагинацию на первую страницу при изменении фильтра
- для `text` фильтров использует debounce
- для `boolean` и `select` фильтров показывает `select`
- умеет догружать dynamic options для relation/select filters через backend

## 4.1. Ширины колонок и длинные тексты

Если backend передал `field.width_px`, `ModelPage` использует это значение как фиксированную ширину колонки.

Если ширина не задана, frontend применяет разумные эвристики:

- JSON и большие тексты получают более широкую колонку
- `date` / `datetime` и `boolean` — более узкую
- `display_kind="image"` рендерится как image-preview с компактной колонкой
- длинные строки в list-view обрезаются примерно до 200 символов и показываются через ellipsis

Если image-поле хранит относительный путь, backend может передать `field.image_url_prefix`, и frontend соберёт итоговый URL из prefix + path.

## 5. Delete preview

Frontend использует два отдельных метода клиента:

- `getDeletePreview(slug, id)`
- `getBulkDeletePreview(slug, ids)`

Оба ответа показываются в `DeletePreviewDialog`.

Самостоятельно этот компонент обычно не нужно подключать: `ModelPage` и `ObjectPage` уже используют его внутри.

## 6. Theme

По умолчанию `Shell` использует встроенную тему библиотеки.

```tsx
<Shell client={client} models={models} blocks={blocks} basePath="/admin" locale={locale}>
    {children}
</Shell>
```

Если проект хочет свою тему, её можно передать явно:

```tsx
import {createTheme} from '@mui/material/styles';
import {Shell, defaultAdminTheme} from 'xladmin';


const adminTheme = createTheme(defaultAdminTheme, {
    palette: {
        background: {
            default: '#0b0b0d',
            paper: '#171719',
        },
    },
});


<Shell
    client={client}
    models={models}
    blocks={blocks}
    basePath="/admin"
    locale={locale}
    theme={adminTheme}
>
    {children}
</Shell>
```

## 7. Что важно про transport

Библиотека не навязывает `axios`.

Поддерживаются:

- `createAxiosXLAdminClient(...)`
- `createFetchXLAdminClient(...)`
- полностью свой `XLAdminClient`

Главное, чтобы frontend-клиент умел ходить в backend endpoints пакета `xladmin`.

## 8. Совместимость

Основные короткие имена:

- `Shell`
- `OverviewPage`
- `ModelPage`
- `ObjectPage`
- `FieldEditor`
- `FormDialog`
- `ModelsBlocks`
- `NavLink`

Старые alias тоже экспортируются для совместимости:

- `AdminShell`
- `AdminHome`
- `AdminModelPage`
- `AdminObjectPage`
- `AdminFieldEditor`
- `AdminFormDialog`
- `AdminModelsBlocks`
- `AdminNavLink`
