# Проверка поставляемых пакетов

Подготовлены кандидаты core/backend 0.10.0, core/frontend и Next/React Router 0.10.0, backend import/export 0.2.0 и frontend import/export 0.3.0. Это версии рабочего дерева, не подтверждение публикации. Extension требует новый core с readonly и scope guards; прежняя нижняя граница 0.2.8 больше недопустима. Backend и frontend имеют независимые реестры версий.

## Python wheels

Из корня репозитория, используя Python с установленными build и twine:

```bash
python scripts/check_backend_artifacts.py --output-dir /absolute/new/artifact-directory
```

Каталог вывода должен быть новым. Проверка собирает wheel через sdist для обоих пакетов, проверяет metadata через twine и наличие py.typed/guards. В отдельный временный venv устанавливаются wheels вместе с настоящими зависимостями и test extras. PYTHONPATH и локальные настройки pip не используются; публичные зависимости берутся из PyPI. Проверяется путь каждого импортированного пакета внутри consumer-venv и совпадение версий с manifest. Затем выполняются только test_model_read_only.py, test_relation_write_scope.py и extension test_router.py — не весь suite. Тесты используют SQLite, рабочая БД не требуется.

result.json сохраняет SHA-256 wheels, версию Python и фактически установленные зависимости. Consumer-venv удаляется после проверки; wheels и sdist остаются в каталоге вывода. Такой результат доказывает установку этих архивов, но не публикацию в PyPI или работу приложения Orcestr с будущими manifest-пинами.

## npm tarballs

После установки workspace-зависимостей:

```bash
cd xladmin-frontend
npm run build
npm run check:artifacts -- --output-dir /absolute/new/npm-artifact-directory
node --test scripts/artifact-workflows.test.mjs
```

Для версий Next/React основного приложения запустить отдельный consumer с новым каталогом вывода:

```bash
npm run check:artifacts -- --next-version 16.2.12 --react-version 19.2.5 --output-dir /absolute/new/npm-next16-directory
```

Overrides принимают точные стабильные версии; react и react-dom обновляются вместе. После установки сверяются фактические версии всех прямых зависимостей consumer, а не только содержимое его manifest. Рабочее окружение приложения и workspace lockfile эта команда не меняет.

Проверяются версии и peerDependencies относительно lockfile, реальные npm pack архивы четырёх пакетов, наличие entrypoints и отсутствие тестовых declarations/fixtures. Tarballs устанавливаются npm в отдельный временный consumer без workspace links, NODE_PATH и NODE_OPTIONS. Версии peer-зависимостей берутся из workspace lockfile. Lifecycle-скрипты установки отключены. Внешний consumer проверяет ESM-импорты, обоих router adapters, настоящий SSR NavLink с tenant в href и item-only POST/PATCH-контракт. Отдельный TypeScript-запуск проверяет опубликованные declarations без paths на src; skipLibCheck относится к внутренностям сторонних declarations, сам consumer проверяется строго.

result.json содержит npm integrity, имена архивов и версии peer-зависимостей. Временный consumer удаляется только после проверки его расположения внутри созданного временного каталога. Это не браузерный E2E, не Next production build и не доказательство всех интерактивных сценариев формы. Локальный прогон Windows/Node 25 также не заменяет CI на Linux/Node 22.

## CI и выпуск

.github/workflows/artifacts.yml запускается для Pull Request и как reusable workflow; npm-потребители проверяются с workspace-версиями и отдельно с Next 16.2.12 / React 19.2.5. Все четыре publish jobs требуют artifact-checks вместе с прежним quality-checks. Новая проверка не отключает существующие тесты, линтеры, проверки типов и сопоставление версии тега. Без запуска GitHub Actions нельзя объявлять CI зелёным по одному чтению YAML.

Коммит, публикация и теги требуют разрешённого PR-процесса. Сначала проверить актуальную удалённую базу и слить согласованные изменения, затем выпускать core до зависимых расширений. Приложение переключать на новую опубликованную версию только после проверки registry и установки опубликованных архивов. Не заменять это file-зависимостями, копированием dist в node_modules или новым пином несуществующей версии. Старый scripts/release.py сам создаёт commit/tag и не обеспечивает PR-процесс; не запускать его для обхода этих шагов.

Publish jobs пока пересобирают пакеты из того же тега; эта проверка подтверждает контракты установки, а не побайтовую идентичность повторной сборки. Перед рабочим включением остаются проверка CI, опубликованных пакетов и самого приложения.
