<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin

`xladmin` is the framework-agnostic React frontend for the `xladmin` backend.

## Read-only models

`AdminModelMeta.read_only` is a required boolean supplied by the backend. When true, model and object pages hide create, edit, delete and action controls; mutation handlers also reject submissions. List navigation, filters and selection for export remain available. `FormDialog` closes through its normal transition and disables pending submission when the model becomes read-only.

`ModelPageToolbarContext.meta.read_only` exposes the same policy to extensions. The import/export extension hides import and blocks validation/commit for read-only models while retaining export. Update backend, frontend and the extension together: these controls require backend metadata support and do not replace server-side authorization or domain commands.

## Install

```bash
npm install xladmin
```

You also need one router adapter:

- `xladmin-next`
- `xladmin-react-router`

## What It Exports

- `Shell`
- `OverviewPage`
- `ModelPage`
- `ObjectPage`
- `FormDialog`
- `FieldEditor`
- `NavLink`
- `createAxiosAdminClient(...)`
- `createFetchAdminClient(...)`
- `createBrowserAdminRouter(...)`
- `AdminCurrentUser`
- admin types, i18n helpers, and default theme

## Minimal Example

```tsx
import {useEffect, useMemo, useState} from 'react';
import {Shell, OverviewPage, createAxiosAdminClient, type AdminModelMeta, type AdminModelsBlockMeta} from 'xladmin';
import axios from 'axios';

const api = axios.create({baseURL: '/api/admin'});

export function AdminApp() {
  const client = useMemo(() => createAxiosAdminClient(api), []);
  const [models, setModels] = useState<AdminModelMeta[]>([]);
  const [blocks, setBlocks] = useState<AdminModelsBlockMeta[]>([]);

  useEffect(() => {
    client.getModels().then((response) => {
      setModels(response.items);
      setBlocks(response.blocks);
    });
  }, [client]);

  return (
    <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale="en">
      <OverviewPage client={client} basePath="/admin" />
    </Shell>
  );
}
```

For framework routing, use one of the adapter packages instead of the default browser router.

## Current User And Logout

`Shell` shows a compact current-user panel pinned to the bottom of the sidebar when a user is available.
Long login values wrap inside the panel instead of overflowing the sidebar.
By default it calls:

- `client.getCurrentUser()` -> `GET /xladmin/me/`
- `client.logout()` -> `POST /xladmin/logout/`

After logout, `Shell` redirects to `/login`.

```tsx
<Shell
  client={client}
  models={models}
  blocks={blocks}
  basePath="/admin"
  loginPath="/login"
>
  {content}
</Shell>
```

If your application already has the user or a custom logout flow, pass them explicitly:

```tsx
<Shell
  client={client}
  models={models}
  blocks={blocks}
  basePath="/admin"
  currentUser={{login: auth.user.email}}
  onLogout={async () => {
    await auth.logout();
  }}
  loginPath="/sign-in"
>
  {content}
</Shell>
```

Set `currentUser={null}` to hide the sidebar user panel.

## Scoped navigation and client lifetime

Every `AdminRouter` implements `resolveHref(href)`. The browser, Next.js and React Router adapters return the original URL. A host can override this method to preserve its workspace or tenant query parameter. `NavLink` uses the resolved URL both in the native anchor and in click navigation, so copying links and opening another tab retain the same context. Keep the resolver pure and idempotent; apply the same resolver in host `push`/`replace` wrappers for programmatic navigation. Custom router implementations must provide this method; tenant selection and authorization remain application concerns.

When the authenticated user or workspace changes, create a new `AdminClient` and remount the workspace subtree with a different React key. Caches are isolated by client identity. The object controller ignores late reads and mutation completions after its scope is retired, including navigation after deletion. The host should also cancel its old transport and prevent new requests through retired clients. Cancelling a request does not roll back an operation already accepted by the server.

## Item response contracts

`getItem` returns `AdminDetailResponse` with `{meta, item}`. `createItem` and `patchItem` return `AdminItemResponse` with `{item}` only. Custom clients and transport mocks must use the same response shapes. After saving an object, retain its loaded metadata and replace its item with the server response; do not read mutation metadata that the HTTP API does not return.

## Development

```bash
npm test
npm run check
npm run build
```

## Docs

- [Russian README](./docs/README.ru.md)
- [Frontend workspace](../../README.md)
- [Monorepo root](../../../README.md)
