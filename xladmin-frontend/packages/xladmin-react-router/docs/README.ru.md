<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-react-router

`xladmin-react-router` даёт адаптер для React Router и `xladmin`.

## Установка

```bash
npm install xladmin xladmin-react-router react-router-dom
```

## Использование

```tsx
import {Shell, createFetchAdminClient} from 'xladmin';
import {useReactRouterAdminRouter} from 'xladmin-react-router';

export function AdminShell({models, blocks}) {
  const client = createFetchAdminClient({baseUrl: '/api/admin'});
  const router = useReactRouterAdminRouter();

  return (
    <Shell client={client} models={models} blocks={blocks} basePath="/admin" locale="en" router={router}>
      {/* your route page */}
    </Shell>
  );
}
```

## Что экспортирует

- `useReactRouterAdminRouter()`
- `createReactRouterAdminRouter(...)`

## Документация

- [English README](../README.md)
- [пакет xladmin](../../xladmin-core/README.md)
