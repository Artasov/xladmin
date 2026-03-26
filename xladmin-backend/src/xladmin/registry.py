from __future__ import annotations

from typing import Any

from xladmin.config import AdminModelConfig


class AdminRegistry:
    """Реестр всех ORM-моделей, которые надо показать в админке."""

    def __init__(self, *configs: AdminModelConfig) -> None:
        self._configs_by_slug: dict[str, AdminModelConfig] = {}
        for config in configs:
            self.register(config)

    def register(self, config: AdminModelConfig) -> None:
        if config.slug in self._configs_by_slug:
            raise ValueError(f"Model slug '{config.slug}' is already registered.")
        self._configs_by_slug[config.slug] = config

    def get(self, slug: str) -> AdminModelConfig:
        try:
            return self._configs_by_slug[slug]
        except KeyError as exc:
            raise KeyError(f"Admin model '{slug}' is not registered.") from exc

    def find_by_model(self, model: type[Any]) -> AdminModelConfig | None:
        for config in self._configs_by_slug.values():
            if config.model is model:
                return config
        return None

    def list(self) -> list[AdminModelConfig]:
        return list(self._configs_by_slug.values())
