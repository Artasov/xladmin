"""Model-level restrictions shared by admin transports and mutations."""

from fastapi import HTTPException, status

from xladmin.config import ModelConfig


class ModelWriteAccess:
    @staticmethod
    def check(config: ModelConfig) -> None:
        """Reject writes before invoking handlers or changing ORM state."""
        if config.read_only:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This admin model is read-only.")
