<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin frontend workspace

This workspace contains the frontend packages for `xladmin`.

## Packages

- [xladmin](./packages/xladmin-core/README.md) - framework-agnostic React + MUI admin UI
- [xladmin-import-export](./packages/xladmin-import-export/README.md) - optional import/export model actions
- [xladmin-next](./packages/xladmin-next/README.md) - Next.js router adapter
- [xladmin-react-router](./packages/xladmin-react-router/README.md) - React Router adapter

## Workspace Commands

```bash
npm ci
npm test
npm run check
npm run build
npm run pack:dry-run
```

## Notes

- the npm package name for `packages/xladmin-core` is still `xladmin`
- adapters are published as separate npm packages
- all frontend packages are published from the same workflow: `.github/workflows/frontend.yml`

## Docs

- [Russian README](./docs/README.ru.md)
- [xladmin package](./packages/xladmin-core/README.md)
- [xladmin-import-export package](./packages/xladmin-import-export/README.md)
- [xladmin-next package](./packages/xladmin-next/README.md)
- [xladmin-react-router package](./packages/xladmin-react-router/README.md)
- [Root release guide](../docs/RELEASE_GUIDE.md)
