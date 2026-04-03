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

- [xladmin](../packages/xladmin-core/README.md) — framework-agnostic React + MUI admin UI, npm: [xladmin](https://www.npmjs.com/package/xladmin)
- [xladmin-import-export](../packages/xladmin-import-export/README.md) — optional import/export model actions, npm: [xladmin-import-export](https://www.npmjs.com/package/xladmin-import-export)
- [xladmin-next](../packages/xladmin-next/README.md) — адаптер роутера для Next.js, npm: [xladmin-next](https://www.npmjs.com/package/xladmin-next)
- [xladmin-react-router](../packages/xladmin-react-router/README.md) — адаптер для React Router, npm: [xladmin-react-router](https://www.npmjs.com/package/xladmin-react-router)

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
- `xladmin`, `xladmin-next` и `xladmin-react-router` публикуются из `.github/workflows/frontend.yml`
- `xladmin-import-export` публикуется из `.github/workflows/frontend-import-export.yml`

## Документация

- [English README](../README.md)
- [пакет xladmin](../packages/xladmin-core/README.md)
- [пакет xladmin-import-export](../packages/xladmin-import-export/README.md)
- [пакет xladmin-next](../packages/xladmin-next/README.md)
- [пакет xladmin-react-router](../packages/xladmin-react-router/README.md)
- [общий release guide](../../docs/RELEASE_GUIDE.md)
