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

Пакеты:

- [xladmin-backend](../xladmin-backend/README.md) — пакет для PyPI с именем `xladmin`
- [xladmin-frontend](../xladmin-frontend/README.md) — frontend workspace
- [xladmin](../xladmin-frontend/packages/xladmin-core/README.md) — framework-agnostic React UI
- [xladmin-next](../xladmin-frontend/packages/xladmin-next/README.md) — адаптер роутера для Next.js
- [xladmin-react-router](../xladmin-frontend/packages/xladmin-react-router/README.md) — адаптер для React Router

## Что есть из коробки

- overview моделей и блоки моделей в sidebar
- страницы списка с поиском, сортировкой, фильтрами, пагинацией и bulk actions
- страницы объекта с create, update, delete и preview удаления
- relation choices и relation filters
- локали админки RU / EN
- независимая публикация backend и frontend части

## Основные разделы

- [xladmin-backend/README.md](../xladmin-backend/README.md)
- [xladmin-frontend/README.md](../xladmin-frontend/README.md)
- [RELEASE_GUIDE.md](RELEASE_GUIDE.md)

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
- тег frontend: `frontend-vX.Y.Z`

Подробности по ручным релизам и trusted publishing: [RELEASE_GUIDE.md](RELEASE_GUIDE.md).
