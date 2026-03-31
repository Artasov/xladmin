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

Packages:

- [xladmin-backend](./xladmin-backend) - PyPI package `xladmin`
- [xladmin-frontend](./xladmin-frontend) - frontend workspace
- [xladmin](./xladmin-frontend/packages/xladmin-core) - framework-agnostic React admin UI
- [xladmin-next](./xladmin-frontend/packages/xladmin-next) - Next.js router adapter
- [xladmin-react-router](./xladmin-frontend/packages/xladmin-react-router) - React Router adapter

## What You Get

- models overview and grouped sidebar blocks
- list pages with search, sorting, filters, pagination, and bulk actions
- object pages with create, update, delete, and delete preview
- relation field choices and relation filters
- RU / EN admin locale
- backend and frontend published independently

## Repository Layout

- [xladmin-backend/README.md](./xladmin-backend/README.md)
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
- frontend tag: `frontend-vX.Y.Z`

See [RELEASE_GUIDE.md](./docs/RELEASE_GUIDE.md) for manual publish commands and trusted publishing setup.
