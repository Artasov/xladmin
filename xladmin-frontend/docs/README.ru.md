<div align="center">
  <a href="../README.md">
    <img src="https://img.shields.io/badge/English-blue?style=for-the-badge" alt="English">
  </a>
  <a href="./README.ru.md">
    <img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-red?style=for-the-badge" alt="Russian">
  </a>
</div>

# xladmin frontend workspace

Этот workspace содержит frontend-пакеты `xladmin`.

## Пакеты

- [xladmin](../packages/xladmin-core/README.md) — framework-agnostic React + MUI admin UI
- [xladmin-next](../packages/xladmin-next/README.md) — адаптер роутера для Next.js
- [xladmin-react-router](../packages/xladmin-react-router/README.md) — адаптер для React Router

## Команды workspace

```bash
npm ci
npm test
npm run check
npm run build
npm run pack:dry-run
```

## Что важно

- npm-пакет из `packages/xladmin-core` по-прежнему называется `xladmin`
- адаптеры публикуются отдельными npm-пакетами
- все frontend-пакеты публикуются одним workflow: `.github/workflows/frontend.yml`

## Документация

- [English README](../README.md)
- [пакет xladmin](../packages/xladmin-core/README.md)
- [пакет xladmin-next](../packages/xladmin-next/README.md)
- [пакет xladmin-react-router](../packages/xladmin-react-router/README.md)
- [общий release guide](../../docs/RELEASE_GUIDE.md)
