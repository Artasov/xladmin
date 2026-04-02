from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ImportExportFormat = Literal["xlsx", "csv", "json"]
ImportConflictMode = Literal["auto_generate_pk", "update_existing", "skip_existing"]


@dataclass(slots=True)
class ImportExportConfig:
    export_formats: tuple[ImportExportFormat, ...] = ("xlsx", "csv", "json")
    import_formats: tuple[ImportExportFormat, ...] = ("xlsx", "csv", "json")
    export_fields: tuple[str, ...] | None = None
    import_fields: tuple[str, ...] | None = None
    default_export_fields: tuple[str, ...] | None = None
    default_import_fields: tuple[str, ...] | None = None
    conflict_modes: tuple[ImportConflictMode, ...] = (
        "auto_generate_pk",
        "update_existing",
        "skip_existing",
    )
