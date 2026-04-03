<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin-import-export frontend

Optional frontend extension for `xladmin` that adds import/export actions to model pages.

## Features

- export and import icon buttons for the model toolbar
- export dialog with format and field selection
- import dialog with file upload, conflict mode, validation preview, and commit
- works with `xladmin` selection state, including "select all current results"

## Install

```bash
npm install xladmin xladmin-import-export
```

## Minimal Example

```tsx
import {ModelPage} from 'xladmin';
import {
  ModelImportExportActions,
  createAxiosAdminImportExportClient,
} from 'xladmin-import-export';

const importExportClient = createAxiosAdminImportExportClient(api);

<ModelPage
  client={client}
  basePath="/admin"
  slug="users"
  renderBeforePagination={(context) => (
    <ModelImportExportActions client={importExportClient} context={context} />
  )}
/>
```

## Development

```bash
cd xladmin-frontend
npm run test --workspace ./packages/xladmin-import-export
npm run check --workspace ./packages/xladmin-import-export
npm run build --workspace ./packages/xladmin-import-export
```

## Docs

- [npm package](https://www.npmjs.com/package/xladmin-import-export)
- [Monorepo README](../../../README.md)
