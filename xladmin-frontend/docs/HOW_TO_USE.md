# HOW TO USE

## 1. Быстрое подключение

Фронтенд-библиотека ждёт не “проектный API”, а клиент, совместимый с контрактом `XLAdminClient`.

Самые частые варианты:

### Axios

```tsx
'use client';

import {useMemo} from 'react';
import {AdminHome, AdminShell, createAxiosXLAdminClient} from 'xladmin';
import {api} from '@/modules/Api/client';


export function XLAdminHomePageClient({models}: {models: []}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <AdminShell client={client} models={models} basePath="/admin">
            <AdminHome client={client} basePath="/admin" />
        </AdminShell>
    );
}
```

### Fetch

```tsx
'use client';

import {useMemo} from 'react';
import {AdminHome, AdminShell, createFetchXLAdminClient} from 'xladmin';


export function XLAdminHomePageClient({models}: {models: []}) {
    const client = useMemo(() => createFetchXLAdminClient({
        baseUrl: '/api/v1',
        credentials: 'include',
        headers: () => ({
            'X-CSRFToken': window.localStorage.getItem('csrf') ?? '',
        }),
    }), []);

    return (
        <AdminShell client={client} models={models} basePath="/admin">
            <AdminHome client={client} basePath="/admin" />
        </AdminShell>
    );
}
```

### Свой XLAdminClient

```tsx
import type {XLAdminClient} from 'xladmin';


const client: XLAdminClient = {
    getModels: async () => ({items: []}),
    getModel: async (slug) => fetchModelSomehow(slug),
    getItems: async (slug, params) => fetchItemsSomehow(slug, params),
    getItem: async (slug, id) => fetchItemSomehow(slug, id),
    createItem: async (slug, payload) => createItemSomehow(slug, payload),
    patchItem: async (slug, id, payload) => patchItemSomehow(slug, id, payload),
    deleteItem: async (slug, id) => deleteItemSomehow(slug, id),
    bulkDelete: async (slug, ids) => bulkDeleteSomehow(slug, ids),
    runBulkAction: async (slug, actionSlug, ids, payload) => runBulkActionSomehow(slug, actionSlug, ids, payload),
    runObjectAction: async (slug, id, actionSlug, payload) => runObjectActionSomehow(slug, id, actionSlug, payload),
    getChoices: async (slug, fieldName, q, ids) => fetchChoicesSomehow(slug, fieldName, q, ids),
};
```

## 2. Нормальная интеграция в проект

Обычно проект делает маленькие обёртки, а не вставляет библиотечные компоненты прямо в `app`.

```tsx
'use client';

import {useMemo} from 'react';
import {
    AdminHome,
    AdminModelPage,
    AdminObjectPage,
    AdminShell,
    createAxiosXLAdminClient,
    type AdminModelMeta,
} from 'xladmin';

import {api} from '@/modules/Api/client';


type XLAdminShellProps = {
    models: AdminModelMeta[];
    children: React.ReactNode;
};


function XLAdminShellRoot({models, children}: XLAdminShellProps) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <AdminShell client={client} models={models} basePath="/ru/admin">
            {children}
        </AdminShell>
    );
}


export function XLAdminHomePageClient({models}: {models: AdminModelMeta[]}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <XLAdminShellRoot models={models}>
            <AdminHome client={client} basePath="/ru/admin" />
        </XLAdminShellRoot>
    );
}


export function XLAdminModelPageClient({
    models,
    slug,
}: {
    models: AdminModelMeta[];
    slug: string;
}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <XLAdminShellRoot models={models}>
            <AdminModelPage client={client} basePath="/ru/admin" slug={slug} />
        </XLAdminShellRoot>
    );
}


export function XLAdminObjectPageClient({
    models,
    slug,
    id,
}: {
    models: AdminModelMeta[];
    slug: string;
    id: string;
}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);

    return (
        <XLAdminShellRoot models={models}>
            <AdminObjectPage client={client} slug={slug} id={id} />
        </XLAdminShellRoot>
    );
}
```

## 3. Тема библиотеки

По умолчанию `AdminShell` использует встроенную тёмную тему библиотеки.

```tsx
<AdminShell client={client} models={models} basePath="/admin">
    {children}
</AdminShell>
```

Если проект хочет свою тему, её можно передать явно:

```tsx
import {createTheme} from '@mui/material/styles';
import {AdminShell, defaultAdminTheme} from 'xladmin';


const adminTheme = createTheme(defaultAdminTheme, {
    palette: {
        background: {
            default: '#0b0b0d',
            paper: '#171719',
        },
    },
});


<AdminShell
    client={client}
    models={models}
    basePath="/admin"
    theme={adminTheme}
>
    {children}
</AdminShell>
```

Важно:

- если `theme` не передан, используется встроенная тема библиотеки
- если `theme` передан, используется уже она
- если нужно унаследовать дефолтную тему, удобнее строить свою от `defaultAdminTheme`

## 4. Что делает frontend сам

`AdminModelPage`

- показывает список объектов
- читает `sort` и `q` из query params
- пишет их обратно в URL
- поддерживает infinite scroll
- берёт `page_size` из backend-меты модели
- показывает bulk actions через меню `Действия`

`AdminObjectPage`

- открывает объект
- даёт inline-редактирование
- показывает справа панель действий
- показывает `Сохранить` только если форма реально изменена
- показывает `Удалить` и кастомные object actions из backend-конфига

`AdminFieldEditor`

- `boolean` -> `Switch`
- `date` -> `DatePicker`
- `datetime` -> `DateTimePicker`
- relation -> `Autocomplete`
- обычные поля -> `TextField`

## 5. Что важно про transport

Библиотека не навязывает `axios`.

Контракт такой:

- можно использовать `createAxiosXLAdminClient(...)`
- можно использовать `createFetchXLAdminClient(...)`
- можно полностью реализовать `XLAdminClient` вручную

Главное, чтобы frontend-клиент умел ходить в backend endpoints пакета `xladmin`.
