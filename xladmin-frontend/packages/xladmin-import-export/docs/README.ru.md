<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Русский">
  </a>
</div>

# xladmin-import-export frontend

Опциональное frontend-расширение для `xladmin`, которое добавляет import/export действия на страницу модели.

## Что умеет

- кнопки import/export в toolbar страницы модели
- модалка экспорта с выбором формата и полей
- модалка импорта с загрузкой файла, режимом конфликта PK, проверкой и подтверждением
- умеет работать с текущим выделением и режимом "выбрать все текущие результаты"

## Установка

```bash
npm i xladmin xladmin-import-export
```

## Базовое подключение

```tsx
import {ModelPage} from 'xladmin';
import {
  ModelImportExportActions,
  createAxiosXLAdminImportExportClient,
} from 'xladmin-import-export';

const importExportClient = createAxiosXLAdminImportExportClient(api);

<ModelPage
  client={client}
  basePath="/admin"
  slug="users"
  renderBeforePagination={(context) => (
    <ModelImportExportActions client={importExportClient} context={context} />
  )}
/>
```

## Разработка

```bash
cd xladmin-frontend
npm run test --workspace ./packages/xladmin-import-export
npm run check --workspace ./packages/xladmin-import-export
npm run build --workspace ./packages/xladmin-import-export
```
