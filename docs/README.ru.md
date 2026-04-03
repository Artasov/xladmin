<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin

`xladmin` — это монорепа с админкой в стиле Django поверх `FastAPI + SQLAlchemy + React`.

## Пакеты

- backend core:
  - repo: [xladmin-backend/xladmin-core](../xladmin-backend/xladmin-core/README.md)
  - PyPI: [xladmin](https://pypi.org/project/xladmin/)
- backend import/export:
  - repo: [xladmin-backend/xladmin-import-export](../xladmin-backend/xladmin-import-export/README.md)
  - PyPI: [xladmin-import-export](https://pypi.org/project/xladmin-import-export/)
- frontend core:
  - repo: [xladmin-frontend/packages/xladmin-core](../xladmin-frontend/packages/xladmin-core/README.md)
  - npm: [xladmin](https://www.npmjs.com/package/xladmin)
- frontend import/export:
  - repo: [xladmin-frontend/packages/xladmin-import-export](../xladmin-frontend/packages/xladmin-import-export/README.md)
  - npm: [xladmin-import-export](https://www.npmjs.com/package/xladmin-import-export)
- frontend adapters:
  - repo: [xladmin-frontend/packages/xladmin-next](../xladmin-frontend/packages/xladmin-next/README.md)
  - npm: [xladmin-next](https://www.npmjs.com/package/xladmin-next)
  - repo: [xladmin-frontend/packages/xladmin-react-router](../xladmin-frontend/packages/xladmin-react-router/README.md)
  - npm: [xladmin-react-router](https://www.npmjs.com/package/xladmin-react-router)

Документация workspace:

- [xladmin-frontend workspace](../xladmin-frontend/README.md)
- [release guide](./RELEASE_GUIDE.md)

## Что есть из коробки

- overview моделей и блоки моделей в sidebar
- страницы списка с поиском, сортировкой, фильтрами, пагинацией и bulk actions
- single и multi-select relation filters
- страницы объекта с create, update, delete и preview удаления
- relation choices и relation filters
- локали админки RU / EN
- независимая публикация backend и frontend части

## Основные разделы

- [xladmin-backend/xladmin-core/README.md](../xladmin-backend/xladmin-core/README.md)
- [xladmin-backend/xladmin-import-export/README.md](../xladmin-backend/xladmin-import-export/README.md)
- [xladmin-frontend/README.md](../xladmin-frontend/README.md)
- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md)

## Локальные проверки

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

## Публикация

- тег backend: `backend-vX.Y.Z`
- тег backend import/export: `backend-import-export-vX.Y.Z`
- тег frontend: `frontend-vX.Y.Z`
- тег frontend import/export: `frontend-import-export-vX.Y.Z`

Подробности по ручным релизам и trusted publishing: [RELEASE_GUIDE.md](./RELEASE_GUIDE.md).
