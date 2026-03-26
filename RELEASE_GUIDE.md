# Release Guide

## Теги монорепы

Для пакетов используются разные теги:

- `frontend-vX.Y.Z` — релиз `xladmin` в npm
- `backend-vX.Y.Z` — релиз `xladmin` в PyPI

## Локальные helper-скрипты

Dry run:

```bash
uv run python scripts/release.py frontend patch --dry-run
uv run python scripts/release.py backend patch --dry-run
```

Обычный bump:

```bash
uv run python scripts/release.py frontend patch
uv run python scripts/release.py backend patch
```

Или через PowerShell:

```powershell
./scripts/release.ps1 frontend patch
./scripts/release.ps1 backend patch
```

Сразу с push:

```bash
uv run python scripts/release.py frontend patch --push
uv run python scripts/release.py backend patch --push
```

Что делает скрипт:

1. Проверяет, что git worktree чистый.
2. Поднимает версию нужного пакета.
3. Создаёт commit `chore: release ...`.
4. Создаёт tag нужного формата.
5. При `--push` пушит commit и tag.

## Ручной релиз frontend в npm

1. Войди в npm:

```bash
npm login
```

2. Прогони проверки:

```bash
cd xladmin-frontend
npm run check
npm run build
npm pack --dry-run
```

3. Опубликуй пакет:

```bash
npm publish --access public
```

Если пакет scoped, `--access public` всё равно лучше оставить явно.

## Ручной релиз backend в PyPI

1. Поставь dev-зависимости:

```bash
cd xladmin-backend
uv sync --extra dev
```

2. Прогони проверки:

```bash
uv run pytest -q
uv run ruff check .
uv run mypy
uv run python -m build
uv run python -m twine check dist/*
```

3. Опубликуй пакет:

```bash
uv run python -m twine upload dist/*
```

Логин:

```text
__token__
```

Пароль:

```text
pypi-...
```

## Автоматический релиз frontend через GitHub Actions

Workflow: `.github/workflows/frontend.yml`

Что нужно настроить в npm:

1. Открыть пакет `xladmin`
2. Зайти в `Settings -> Trusted publishing`
3. Добавить GitHub publisher:
   - owner: `Artasov`
   - repo: `xladmin`
   - workflow: `frontend.yml`

Что нужно настроить в GitHub:

1. Никакой `NPM_TOKEN` не нужен
2. Запушить тег вида:

```bash
git push origin frontend-v0.1.1
```

Что сделает workflow:

- поставит зависимости frontend
- прогонит `npm run check`
- прогонит `npm run build`
- проверит, что версия в `package.json` совпадает с тегом
- опубликует пакет в npm через trusted publishing

## Автоматический релиз backend через GitHub Actions

Workflow: `.github/workflows/backend.yml`

Что нужно настроить в PyPI:

1. Создать pending publisher / trusted publisher
2. Указать:
   - repo: `Artasov/xladmin`
   - workflow: `backend.yml`
   - environment: `pypi`

Что нужно настроить в GitHub:

1. Создать environment `pypi`
2. Запушить тег вида:

```bash
git push origin backend-v0.1.1
```

Что сделает workflow:

- поставит зависимости backend
- прогонит `pytest`, `ruff`, `mypy`
- соберёт пакет
- прогонит `twine check`
- проверит, что версия в `pyproject.toml` совпадает с тегом
- опубликует пакет в PyPI через trusted publishing
