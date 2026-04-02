# Release Guide

## Tags

The monorepo uses separate release tags:

- `frontend-vX.Y.Z` for npm packages
- `frontend-import-export-vX.Y.Z` for the npm import/export extension
- `backend-vX.Y.Z` for the PyPI package
- `backend-import-export-vX.Y.Z` for the PyPI import/export extension

## Local Helper Scripts

Dry run:

```bash
uv run python scripts/release.py frontend patch --dry-run
uv run python scripts/release.py frontend-import-export patch --dry-run
uv run python scripts/release.py backend patch --dry-run
uv run python scripts/release.py backend-import-export patch --dry-run
```

Normal bump:

```bash
uv run python scripts/release.py frontend patch
uv run python scripts/release.py frontend-import-export patch
uv run python scripts/release.py backend patch
uv run python scripts/release.py backend-import-export patch
```

You can use any of the standard bump levels:

```bash
uv run python scripts/release.py frontend patch
uv run python scripts/release.py frontend minor
uv run python scripts/release.py frontend major

uv run python scripts/release.py frontend-import-export patch
uv run python scripts/release.py frontend-import-export minor
uv run python scripts/release.py frontend-import-export major

uv run python scripts/release.py backend patch
uv run python scripts/release.py backend minor
uv run python scripts/release.py backend major

uv run python scripts/release.py backend-import-export patch
uv run python scripts/release.py backend-import-export minor
uv run python scripts/release.py backend-import-export major
```

PowerShell wrapper:

```powershell
./scripts/release.ps1 frontend patch
./scripts/release.ps1 frontend-import-export patch
./scripts/release.ps1 backend patch
./scripts/release.ps1 backend-import-export patch
```

The same works for `minor` and `major`:

```powershell
./scripts/release.ps1 frontend minor
./scripts/release.ps1 frontend major

./scripts/release.ps1 frontend-import-export minor
./scripts/release.ps1 frontend-import-export major

./scripts/release.ps1 backend minor
./scripts/release.ps1 backend major

./scripts/release.ps1 backend-import-export minor
./scripts/release.ps1 backend-import-export major
```

With push:

```bash
uv run python scripts/release.py frontend patch --push
uv run python scripts/release.py frontend-import-export patch --push
uv run python scripts/release.py backend patch --push
uv run python scripts/release.py backend-import-export patch --push
```

The release script:

1. Checks that the git worktree is clean.
2. Bumps the target package version.
3. Creates a `chore: release ...` commit.
4. Creates the matching release tag.
5. Pushes commit and tag when `--push` is used.

## Manual npm Publish

Before the first manual publish:

```bash
npm login
```

Run checks:

```bash
cd xladmin-frontend
npm ci
npm test
npm run check
npm run build
npm run pack:dry-run
```

Publish each package manually from its own directory:

```bash
cd packages/xladmin-core
npm publish --access public

cd ../xladmin-next
npm publish --access public

cd ../xladmin-react-router
npm publish --access public

cd ../xladmin-import-export
npm publish --access public
```

## Manual PyPI Publish

```bash
cd xladmin-backend
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run mypy
uv run python -m build
uv run python -m twine check dist/*
uv run python -m twine upload dist/*
```

Use:

- username: `__token__`
- password: `pypi-...`

## Automated npm Publish

Workflow: `.github/workflows/frontend.yml`
Workflow for import/export frontend extension: `.github/workflows/frontend-import-export.yml`

Create trusted publishers in npm for these packages:

- `xladmin`
- `xladmin-import-export`
- `xladmin-next`
- `xladmin-react-router`

For each package, configure:

- GitHub owner: `Artasov`
- repository: `xladmin`
- workflow file: `.github/workflows/frontend.yml`

For `xladmin-import-export`, configure:

- GitHub owner: `Artasov`
- repository: `xladmin`
- workflow file: `.github/workflows/frontend-import-export.yml`

Then push a tag like:

```bash
git push origin frontend-v0.1.8
```

The workflow will:

- install dependencies
- run tests and typechecks
- build all frontend packages
- verify package versions match the tag
- publish all three npm packages

Import/export extension publish tag:

```bash
git push origin frontend-import-export-v0.1.0
```

## Automated PyPI Publish

Workflow: `.github/workflows/backend.yml`
Workflow for import/export backend extension: `.github/workflows/backend-import-export.yml`

Create a trusted publisher in PyPI with:

- repository: `Artasov/xladmin`
- workflow: `backend.yml`
- environment: `pypi`

Create the `pypi` environment in GitHub and push a tag:

```bash
git push origin backend-v0.1.8
```

The workflow will:

- run tests, ruff, and mypy
- build the backend package
- verify metadata
- verify the tag version
- publish to PyPI through trusted publishing

Create one more trusted publisher for the backend import/export extension with:

- repository: `Artasov/xladmin`
- workflow: `backend-import-export.yml`
- environment: `pypi`

Publish tag:

```bash
git push origin backend-import-export-v0.1.0
```
