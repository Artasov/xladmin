"""Собирает distributions и проверяет установленные wheels без editable-подмен."""

import argparse
import hashlib
import importlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import tomllib
from zipfile import ZipFile


class BackendArtifactCheck:
    """Проверяет упаковку и выбранные security-контракты в отдельном consumer-окружении."""

    root = Path(__file__).resolve().parents[1]
    packages = ("xladmin-core", "xladmin-import-export")

    @staticmethod
    def execute(arguments: list[str], directory: Path, *, capture: bool = False) -> str:
        """Завершает проверку при ошибке и не наследует локальную подмену Python imports."""
        environment = os.environ.copy()
        for key in ("PYTHONPATH", "PYTEST_ADDOPTS"):
            environment.pop(key, None)
        # Эти публичные пакеты проверяются против PyPI, без локального pip.ini
        # с недоступным зеркалом или дополнительными источниками разработчика.
        environment["PIP_CONFIG_FILE"] = os.devnull
        environment.pop("PIP_EXTRA_INDEX_URL", None)
        environment["PIP_INDEX_URL"] = "https://pypi.org/simple"
        print(f"Running: {' '.join(arguments)}", flush=True)
        result = subprocess.run(arguments, cwd=directory, env=environment, check=True,
            capture_output=capture, text=True)
        return result.stdout or ""

    @classmethod
    def verify_installed(cls) -> None:
        """Проверяет реальные пути imports, версии и новый readonly-контракт core/extension."""
        from fastapi import HTTPException
        from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
        from xladmin import ModelConfig
        from xladmin.access import ModelWriteAccess
        from xladmin.relation_writes import RelationWriteAccess

        for package, module in (("xladmin-core", "xladmin"), ("xladmin-import-export", "xladmin_import_export")):
            manifest = tomllib.loads((cls.root / "xladmin-backend" / package / "pyproject.toml").read_text(encoding="utf-8"))
            installed = importlib.import_module(module)
            origin = Path(installed.__file__).resolve()
            if not origin.is_relative_to(Path(sys.prefix).resolve()) or origin.is_relative_to(cls.root):
                raise RuntimeError(f"Import did not come from the isolated wheel installation: {origin}")
            name = manifest["project"]["name"]
            if importlib.metadata.version(name) != manifest["project"]["version"]:
                raise RuntimeError(f"Unexpected installed version of {name}")
            print(f"Installed artifact: {name} {importlib.metadata.version(name)} at {origin}", flush=True)

        class Base(DeclarativeBase):
            pass

        class Record(Base):
            __tablename__ = "artifact_record"
            id: Mapped[int] = mapped_column(primary_key=True)

        config = ModelConfig(Record, read_only=True)
        try:
            ModelWriteAccess.check(config)
        except HTTPException as failure:
            if failure.status_code != 403:
                raise
        else:
            raise RuntimeError("Installed core does not protect read-only models")
        if not callable(RelationWriteAccess.items):
            raise RuntimeError("Installed core is missing scoped relation writes")

    @classmethod
    def run(cls, output: Path) -> None:
        """Строит wheel через sdist, устанавливает зависимости с нуля и запускает три целевых файла."""
        output = output.resolve()
        output.mkdir(parents=True, exist_ok=False)
        wheels = []
        distributions = []
        for package in cls.packages:
            source = cls.root / "xladmin-backend" / package
            destination = output / package
            cls.execute([sys.executable, "-I", "-m", "build", "--outdir", str(destination), str(source)], cls.root)
            built = list(destination.glob("*.whl"))
            if len(built) != 1 or len(list(destination.glob("*.tar.gz"))) != 1:
                raise RuntimeError(f"Expected one wheel and one sdist for {package}")
            wheel = built[0]
            with ZipFile(wheel) as archive:
                module = "xladmin" if package == "xladmin-core" else "xladmin_import_export"
                if f"{module}/py.typed" not in archive.namelist():
                    raise RuntimeError(f"Missing py.typed in {wheel.name}")
                if package == "xladmin-core" and not {"xladmin/access.py", "xladmin/relation_writes.py"}.issubset(archive.namelist()):
                    raise RuntimeError("The wheel is missing administrative write guards")
            wheels.append(wheel)
            distributions.extend(sorted(destination.iterdir()))
        cls.execute([sys.executable, "-I", "-m", "twine", "check", *map(str, distributions)], cls.root)
        with TemporaryDirectory(prefix="xladmin-wheel-consumer-") as temporary:
            consumer = Path(temporary)
            environment = consumer / "venv"
            cls.execute([sys.executable, "-I", "-m", "venv", str(environment)], consumer)
            python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            cls.execute([str(python), "-I", "-m", "pip", "install", "--disable-pip-version-check", "--no-input",
                *[f"{wheel}[test]" for wheel in wheels]], consumer)
            cls.execute([str(python), "-I", str(Path(__file__).resolve()), "--verify-installed"], consumer)
            core = cls.root / "xladmin-backend" / "xladmin-core"
            extension = cls.root / "xladmin-backend" / "xladmin-import-export"
            cls.execute([str(python), "-I", "-m", "pytest", "--import-mode=importlib", "-q",
                "-c", str(core / "pyproject.toml"),
                str(core / "tests/test_model_read_only.py"), str(core / "tests/test_relation_write_scope.py"),
                str(extension / "tests/test_router.py")], consumer)
            dependencies = json.loads(cls.execute([str(python), "-I", "-m", "pip", "list", "--format=json"], consumer, capture=True))
        report = {"wheels": [{"path": str(wheel), "sha256": hashlib.sha256(wheel.read_bytes()).hexdigest()} for wheel in wheels],
            "python": sys.version, "dependencies": dependencies, "isolated_install": True, "targeted_tests": "passed"}
        (output / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Artifact verification passed: {output}", flush=True)

    @classmethod
    def main(cls) -> None:
        """Предоставляет отдельные команды сборки и проверки consumer-процесса."""
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--output-dir", type=Path)
        parser.add_argument("--verify-installed", action="store_true")
        arguments = parser.parse_args()
        if arguments.verify_installed:
            cls.verify_installed()
        elif arguments.output_dir is not None:
            cls.run(arguments.output_dir)
        else:
            parser.error("--output-dir is required")


if __name__ == "__main__":
    BackendArtifactCheck.main()
