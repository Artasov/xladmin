<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-next

`xladmin-next` provides the Next.js router adapter for `xladmin`.

## Install

```bash
npm install xladmin xladmin-next
```

## Usage

```tsx
'use client';

import {Shell, createFetchXLAdminClient} from 'xladmin';
import {useNextXLAdminRouter} from 'xladmin-next';

export function AdminShell({models, blocks}) {
  const client = createFetchXLAdminClient({baseUrl: '/api/admin'});
  const router = useNextXLAdminRouter();

  return (
    <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale="en" router={router}>
      {/* your route page */}
    </Shell>
  );
}
```

## Exports

- `useNextXLAdminRouter()`
- `createNextXLAdminRouter(...)`

## Docs

- [Russian README](./docs/README.ru.md)
- [xladmin package](../xladmin-core/README.md)
