<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-next

`xladmin-next` даёт адаптер роутера Next.js для `xladmin`.

## Установка

```bash
npm install xladmin xladmin-next
```

## Использование

```tsx
'use client';

import {Shell, createFetchAdminClient} from 'xladmin';
import {useNextAdminRouter} from 'xladmin-next';

export function AdminShell({models, blocks}) {
  const client = createFetchAdminClient({baseUrl: '/api/admin'});
  const router = useNextAdminRouter();

  return (
    <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale="en" router={router}>
      {/* your route page */}
    </Shell>
  );
}
```

## Что экспортирует

- `useNextAdminRouter()`
- `createNextAdminRouter(...)`

## Документация

- [English README](../README.md)
- [пакет xladmin](../../xladmin-core/README.md)
