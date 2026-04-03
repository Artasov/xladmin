<div align="center">
  <a href="./README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./docs/README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin

`xladmin` is a monorepo for a Django-like admin stack on top of `FastAPI + SQLAlchemy + React`.

## Packages

- backend core:
  - repo: [xladmin-backend/xladmin-core](./xladmin-backend/xladmin-core/README.md)
  - PyPI: [xladmin](https://pypi.org/project/xladmin/)
- backend import/export:
  - repo: [xladmin-backend/xladmin-import-export](./xladmin-backend/xladmin-import-export/README.md)
  - PyPI: [xladmin-import-export](https://pypi.org/project/xladmin-import-export/)
- frontend core:
  - repo: [xladmin-frontend/packages/xladmin-core](./xladmin-frontend/packages/xladmin-core/README.md)
  - npm: [xladmin](https://www.npmjs.com/package/xladmin)
- frontend import/export:
  - repo: [xladmin-frontend/packages/xladmin-import-export](./xladmin-frontend/packages/xladmin-import-export/README.md)
  - npm: [xladmin-import-export](https://www.npmjs.com/package/xladmin-import-export)
- frontend adapters:
  - repo: [xladmin-frontend/packages/xladmin-next](./xladmin-frontend/packages/xladmin-next/README.md)
  - npm: [xladmin-next](https://www.npmjs.com/package/xladmin-next)
  - repo: [xladmin-frontend/packages/xladmin-react-router](./xladmin-frontend/packages/xladmin-react-router/README.md)
  - npm: [xladmin-react-router](https://www.npmjs.com/package/xladmin-react-router)

Workspace docs:

- [xladmin-frontend workspace](./xladmin-frontend/README.md)
- [Release guide](./docs/RELEASE_GUIDE.md)

## What You Get

- models overview and grouped sidebar blocks
- list pages with search, sorting, filters, pagination, and bulk actions
- single and multi-select relation filters
- object pages with create, update, delete, and delete preview
- relation field choices and relation filters
- RU / EN admin locale
- backend and frontend published independently

## Repository Layout

- [xladmin-backend/xladmin-core/README.md](./xladmin-backend/xladmin-core/README.md)
- [xladmin-backend/xladmin-import-export/README.md](./xladmin-backend/xladmin-import-export/README.md)
- [xladmin-frontend/README.md](./xladmin-frontend/README.md)
- [RELEASE_GUIDE.md](./docs/RELEASE_GUIDE.md)

## Local Checks

```bash
cd xladmin-backend
uv run pytest
uv run ruff check .
uv run mypy

cd ../xladmin-frontend
npm ci
npm test
npm run check
npm run build
npm run pack:dry-run
```

## Publishing

- backend tag: `backend-vX.Y.Z`
- backend import/export tag: `backend-import-export-vX.Y.Z`
- frontend tag: `frontend-vX.Y.Z`
- frontend import/export tag: `frontend-import-export-vX.Y.Z`

See [RELEASE_GUIDE.md](./docs/RELEASE_GUIDE.md) for manual publish commands and trusted publishing setup.
