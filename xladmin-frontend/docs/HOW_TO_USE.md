# How to use

## Next.js

```tsx
'use client';

import {useMemo} from 'react';
import {
    OverviewPage,
    Shell,
    AdminRouterProvider,
    createAxiosAdminClient,
    type AdminLocale,
    type AdminModelMeta,
    type AdminModelsBlockMeta,
} from 'xladmin';
import {useNextAdminRouter} from 'xladmin-next';
import {api} from '@/modules/Api/client';

type Props = {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    locale: AdminLocale;
};

function AdminShellRoot({models, blocks, locale, children}: Props & {children: React.ReactNode}) {
    const client = useMemo(() => createAxiosAdminClient(api), []);
    const router = useNextAdminRouter();

    return (
        <AdminRouterProvider router={router}>
            <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale={locale}>
                {children}
            </Shell>
        </AdminRouterProvider>
    );
}

export function AdminHomePageClient({models, blocks, locale}: Props) {
    return (
        <AdminShellRoot models={models} blocks={blocks} locale={locale}>
            <OverviewPage basePath="/admin" models={models} blocks={blocks} locale={locale} />
        </AdminShellRoot>
    );
}
```

## React Router

```tsx
import {Shell, AdminRouterProvider, createFetchAdminClient} from 'xladmin';
import {useReactRouterAdminRouter} from 'xladmin-react-router';

function AdminShell() {
    const router = useReactRouterAdminRouter();
    const client = createFetchAdminClient({baseUrl: '/api/v1'});

    return (
        <AdminRouterProvider router={router}>
            <Shell client={client} models={[]} blocks={[]} basePath="/admin" locale="en" />
        </AdminRouterProvider>
    );
}
```

## Packages

- `xladmin` exports UI, client factories, router primitives, i18n and types.
- `xladmin-next` exports `useNextAdminRouter`.
- `xladmin-react-router` exports `useReactRouterAdminRouter`.
