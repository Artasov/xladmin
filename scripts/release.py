from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "xladmin-frontend"
BACKEND_DIR = ROOT_DIR / "xladmin-backend"
FRONTEND_PACKAGE_FILE = FRONTEND_DIR / "package.json"
FRONTEND_LOCK_FILE = FRONTEND_DIR / "package-lock.json"
FRONTEND_CORE_PACKAGE_FILE = FRONTEND_DIR / "packages" / "xladmin-core" / "package.json"
FRONTEND_NEXT_PACKAGE_FILE = FRONTEND_DIR / "packages" / "xladmin-next" / "package.json"
FRONTEND_REACT_ROUTER_PACKAGE_FILE = FRONTEND_DIR / "packages" / "xladmin-react-router" / "package.json"
BACKEND_PYPROJECT_FILE = BACKEND_DIR / "pyproject.toml"
VERSION_PATTERN = re.compile(r'(?P<prefix>version\s*=\s*")(?P<version>\d+\.\d+\.\d+)(?P<suffix>")')


class ReleaseError(RuntimeError):
    """Ошибка локального release-flow."""


@dataclass(frozen=True, slots=True)
class PackageReleaseConfig:
    package: str
    directory: Path
    tag_prefix: str


PACKAGE_CONFIGS = {
    "frontend": PackageReleaseConfig(
        package="frontend",
        directory=FRONTEND_DIR,
        tag_prefix="frontend-v",
    ),
    "backend": PackageReleaseConfig(
        package="backend",
        directory=BACKEND_DIR,
        tag_prefix="backend-v",
    ),
}

FRONTEND_PACKAGE_FILES = (
    FRONTEND_CORE_PACKAGE_FILE,
    FRONTEND_NEXT_PACKAGE_FILE,
    FRONTEND_REACT_ROUTER_PACKAGE_FILE,
)


class ReleaseService:
    """
    Локальный helper для релизов монорепы `xladmin`.

    Скрипт:
    - поднимает semver-версию нужного пакета;
    - обновляет package metadata;
    - создаёт commit;
    - создаёт tag нужного формата;
    - при желании пушит commit и tag.
    """

    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir

    def run(self, package: str, part: str, *, push: bool, dry_run: bool) -> str:
        config = PACKAGE_CONFIGS[package]
        current_version = self.get_current_version(config)
        next_version = self.bump_version(current_version, part)
        tag_name = f"{config.tag_prefix}{next_version}"

        print(f"Package: {package}")
        print(f"Current version: {current_version}")
        print(f"Next version: {next_version}")
        print(f"Tag: {tag_name}")

        if dry_run:
            print("Dry run mode. No files or git objects were changed.")
            return next_version

        self.check_worktree_is_clean()
        self.check_tag_does_not_exist(tag_name)
        self.write_version(config, next_version)
        self.stage_version_files(config)
        self.git("commit", "-m", f"chore: release {package} {tag_name}")
        self.git("tag", tag_name)

        if push:
            self.git("push")
            self.git("push", "origin", tag_name)
            print(f"Release {tag_name} was pushed.")
        else:
            print("Release commit and tag were created locally.")
            print("Run these commands when you are ready to publish:")
            print("  git push")
            print(f"  git push origin {tag_name}")

        return next_version

    def get_current_version(self, config: PackageReleaseConfig) -> str:
        if config.package == "frontend":
            versions = {
                package_file: str(json.loads(package_file.read_text(encoding="utf-8"))["version"])
                for package_file in FRONTEND_PACKAGE_FILES
            }
            distinct_versions = set(versions.values())
            if len(distinct_versions) != 1:
                formatted_versions = ", ".join(
                    f"{package_file.relative_to(ROOT_DIR)}={version}"
                    for package_file, version in versions.items()
                )
                raise ReleaseError(f"Frontend package versions are out of sync: {formatted_versions}")
            return next(iter(distinct_versions))

        content = BACKEND_PYPROJECT_FILE.read_text(encoding="utf-8")
        match = VERSION_PATTERN.search(content)
        if match is None:
            raise ReleaseError(f"Version was not found in {BACKEND_PYPROJECT_FILE}.")
        return match.group("version")

    def write_version(self, config: PackageReleaseConfig, version: str) -> None:
        if config.package == "frontend":
            self.write_frontend_version(version)
            return

        content = BACKEND_PYPROJECT_FILE.read_text(encoding="utf-8")
        match = VERSION_PATTERN.search(content)
        if match is None:
            raise ReleaseError(f"Version was not found in {BACKEND_PYPROJECT_FILE}.")
        BACKEND_PYPROJECT_FILE.write_text(
            VERSION_PATTERN.sub(rf"\g<prefix>{version}\g<suffix>", content, count=1),
            encoding="utf-8",
        )

    def write_frontend_version(self, version: str) -> None:
        for package_file in FRONTEND_PACKAGE_FILES:
            package_data = json.loads(package_file.read_text(encoding="utf-8"))
            package_data["version"] = version

            if package_data.get("name") in {"xladmin-next", "xladmin-react-router"}:
                peer_dependencies = package_data.get("peerDependencies")
                if isinstance(peer_dependencies, dict) and "xladmin" in peer_dependencies:
                    peer_dependencies["xladmin"] = f"^{version}"

            package_file.write_text(
                json.dumps(package_data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

        self.npm(
            "install",
            "--package-lock-only",
            cwd=FRONTEND_DIR,
        )

    def stage_version_files(self, config: PackageReleaseConfig) -> None:
        if config.package == "frontend":
            self.git(
                "add",
                self.to_git_path(FRONTEND_LOCK_FILE),
                *(self.to_git_path(package_file) for package_file in FRONTEND_PACKAGE_FILES),
            )
            return

        self.git("add", self.to_git_path(BACKEND_PYPROJECT_FILE))

    def bump_version(self, current_version: str, part: str) -> str:
        major, minor, patch = [int(item) for item in current_version.split(".")]
        if part == "patch":
            patch += 1
        elif part == "minor":
            minor += 1
            patch = 0
        elif part == "major":
            major += 1
            minor = 0
            patch = 0
        else:
            raise ReleaseError(f"Unsupported release part: {part}.")
        return f"{major}.{minor}.{patch}"

    def check_worktree_is_clean(self) -> None:
        result = self.git("status", "--short", capture_output=True)
        if result.stdout.strip():
            raise ReleaseError("Git worktree is not clean. Commit or stash changes before release.")

    def check_tag_does_not_exist(self, tag_name: str) -> None:
        result = self.git(
            "rev-parse",
            "-q",
            "--verify",
            f"refs/tags/{tag_name}",
            check=False,
            capture_output=True,
        )
        if result.returncode == 0:
            raise ReleaseError(f"Git tag {tag_name} already exists.")

    def to_git_path(self, path: Path) -> str:
        return path.relative_to(self.root_dir).as_posix()

    def git(
        self,
        *args: str,
        check: bool = True,
        capture_output: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=self.root_dir,
            check=check,
            text=True,
            capture_output=capture_output,
        )

    def npm(
        self,
        *args: str,
        cwd: Path,
        check: bool = True,
        capture_output: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["npm", *args],
            cwd=cwd,
            check=check,
            text=True,
            capture_output=capture_output,
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bump xladmin package version and create a release tag.")
    parser.add_argument("package", choices=tuple(PACKAGE_CONFIGS.keys()))
    parser.add_argument("part", choices=("patch", "minor", "major"))
    parser.add_argument("--push", action="store_true", help="Push commit and tag after local release.")
    parser.add_argument("--dry-run", action="store_true", help="Only show the next version without changing anything.")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    service = ReleaseService(ROOT_DIR)

    try:
        service.run(args.package, args.part, push=args.push, dry_run=args.dry_run)
    except ReleaseError as exc:
        print(f"Release error: {exc}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as exc:
        print(f"Git command failed: {' '.join(exc.cmd)}", file=sys.stderr)
        return exc.returncode or 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
