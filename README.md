# xladmin

`xladmin` это монорепа с двумя библиотеками.

В обоих registry имя пакета одинаковое:

- npm: `xladmin`
- PyPI: `xladmin`

Папки внутри репозитория остаются разными:

- [xladmin-frontend](./xladmin-frontend) — исходники frontend-пакета `xladmin`
- [xladmin-backend](./xladmin-backend) — исходники backend-пакета `xladmin`

## Структура

```text
xladmin/
  xladmin-frontend/
  xladmin-backend/
  .github/workflows/
  scripts/
```

## Что где лежит

### Frontend

- пакет: [xladmin-frontend/package.json](./xladmin-frontend/package.json)
- README: [xladmin-frontend/README.md](./xladmin-frontend/README.md)
- подробная инструкция: [xladmin-frontend/docs/HOW_TO_USE.md](./xladmin-frontend/docs/HOW_TO_USE.md)

### Backend

- пакет: [xladmin-backend/pyproject.toml](./xladmin-backend/pyproject.toml)
- README: [xladmin-backend/README.md](./xladmin-backend/README.md)
- подробная инструкция: [xladmin-backend/docs/HOW_TO_USE.md](./xladmin-backend/docs/HOW_TO_USE.md)

## Релизы

Для монорепы сделаны отдельные release-flow:

- `frontend-vX.Y.Z` — релиз npm-пакета `xladmin`
- `backend-vX.Y.Z` — релиз PyPI-пакета `xladmin`

Локальные helper-скрипты:

```bash
uv run python scripts/release.py frontend patch
uv run python scripts/release.py backend patch
```

Или через PowerShell:

```powershell
./scripts/release.ps1 frontend patch
./scripts/release.ps1 backend patch
```

Подробно:

- [RELEASE_GUIDE.md](./RELEASE_GUIDE.md)
