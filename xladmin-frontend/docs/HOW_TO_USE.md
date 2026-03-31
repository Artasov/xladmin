# How to use

## Next.js

```tsx
'use client';

import {useMemo} from 'react';
import {
    OverviewPage,
    Shell,
    XLAdminRouterProvider,
    createAxiosXLAdminClient,
    type AdminLocale,
    type AdminModelMeta,
    type AdminModelsBlockMeta,
} from 'xladmin';
import {useNextXLAdminRouter} from 'xladmin-next';
import {api} from '@/modules/Api/client';

type Props = {
    models: AdminModelMeta[];
    blocks: AdminModelsBlockMeta[];
    locale: AdminLocale;
};

function XLAdminShellRoot({models, blocks, locale, children}: Props & {children: React.ReactNode}) {
    const client = useMemo(() => createAxiosXLAdminClient(api), []);
    const router = useNextXLAdminRouter();

    return (
        <XLAdminRouterProvider router={router}>
            <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale={locale}>
                {children}
            </Shell>
        </XLAdminRouterProvider>
    );
}

export function XLAdminHomePageClient({models, blocks, locale}: Props) {
    return (
        <XLAdminShellRoot models={models} blocks={blocks} locale={locale}>
            <OverviewPage basePath="/admin" models={models} blocks={blocks} locale={locale} />
        </XLAdminShellRoot>
    );
}
```

## React Router

```tsx
import {Shell, XLAdminRouterProvider, createFetchXLAdminClient} from 'xladmin';
import {useReactRouterXLAdminRouter} from 'xladmin-react-router';

function AdminShell() {
    const router = useReactRouterXLAdminRouter();
    const client = createFetchXLAdminClient({baseUrl: '/api/v1'});

    return (
        <XLAdminRouterProvider router={router}>
            <Shell client={client} models={[]} blocks={[]} basePath="/admin" locale="en" />
        </XLAdminRouterProvider>
    );
}
```

## Packages

- `xladmin` exports UI, client factories, router primitives, i18n and types.
- `xladmin-next` exports `useNextXLAdminRouter`.
- `xladmin-react-router` exports `useReactRouterXLAdminRouter`.
