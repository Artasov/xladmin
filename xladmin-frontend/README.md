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

- [xladmin](./packages/xladmin-core/README.md) - framework-agnostic React + MUI admin UI, npm: [xladmin](https://www.npmjs.com/package/xladmin)
- [xladmin-import-export](./packages/xladmin-import-export/README.md) - optional import/export model actions, npm: [xladmin-import-export](https://www.npmjs.com/package/xladmin-import-export)
- [xladmin-next](./packages/xladmin-next/README.md) - Next.js router adapter, npm: [xladmin-next](https://www.npmjs.com/package/xladmin-next)
- [xladmin-react-router](./packages/xladmin-react-router/README.md) - React Router adapter, npm: [xladmin-react-router](https://www.npmjs.com/package/xladmin-react-router)

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
- `xladmin`, `xladmin-next`, and `xladmin-react-router` are published from `.github/workflows/frontend.yml`
- `xladmin-import-export` is published from `.github/workflows/frontend-import-export.yml`

## Docs

- [Russian README](./docs/README.ru.md)
- [xladmin package](./packages/xladmin-core/README.md)
- [xladmin-import-export package](./packages/xladmin-import-export/README.md)
- [xladmin-next package](./packages/xladmin-next/README.md)
- [xladmin-react-router package](./packages/xladmin-react-router/README.md)
- [Root release guide](../docs/RELEASE_GUIDE.md)
