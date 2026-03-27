# XLAdmin

- Отвечай коротко и по делу.
- Не ломай публичный API без необходимости. Если переименование нужно, оставляй совместимые alias или обновляй все места использования.
- Перед релизом обязательно прогоняй:
  - `cd xladmin-backend && uv run pytest`
  - `cd xladmin-backend && uv run ruff check .`
  - `cd xladmin-backend && uv run mypy`
  - `cd xladmin-frontend && npm ci`
  - `cd xladmin-frontend && npm run check`
  - `cd xladmin-frontend && npm run build`
  - `cd xladmin-frontend && npm pack --dry-run`
  - `cd xladmin-backend && uv run python -m build`
  - `cd xladmin-backend && uv run python -m twine check dist/*`
- Если есть `inspector_errors`, сначала исправляй их.
- Временные файлы и локальные tarball/lock-проблемы в релиз не тащи.
