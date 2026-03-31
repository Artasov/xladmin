<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin

`xladmin` — framework-agnostic React-фронтенд для backend-пакета `xladmin`.

## Установка

```bash
npm install xladmin
```

Также нужен один router adapter:

- `xladmin-next`
- `xladmin-react-router`

## Что экспортирует пакет

- `Shell`
- `OverviewPage`
- `ModelPage`
- `ObjectPage`
- `FormDialog`
- `FieldEditor`
- `NavLink`
- `createAxiosXLAdminClient(...)`
- `createFetchXLAdminClient(...)`
- `createBrowserXLAdminRouter(...)`
- admin types, i18n helpers и default theme

## Минимальный пример

```tsx
import {useEffect, useMemo, useState} from 'react';
import {Shell, OverviewPage, createAxiosXLAdminClient, type AdminModelMeta, type AdminModelsBlockMeta} from 'xladmin';
import axios from 'axios';

const api = axios.create({baseURL: '/api/admin'});

export function AdminApp() {
  const client = useMemo(() => createAxiosXLAdminClient(api), []);
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

Если нужен framework router, используй один из адаптеров вместо дефолтного browser router.

## Разработка

```bash
npm test
npm run check
npm run build
```

## Документация

- [English README](../README.md)
- [frontend workspace](../../README.md)
- [корень монорепы](../../../../README.md)
