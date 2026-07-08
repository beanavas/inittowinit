import json
import threading
from pathlib import Path
from typing import Any

from app.config import settings

_lock = threading.Lock()


def _safe_path(filename: str) -> Path:
    """Resolve filename within data_dir, preventing path traversal."""
    safe_name = Path(filename).name  # strip any directory components
    resolved = (settings.data_dir / safe_name).resolve()
    data_dir_resolved = settings.data_dir.resolve()
    # Guard against traversal even after resolution
    if not str(resolved).startswith(str(data_dir_resolved)):
        raise ValueError(f"Access denied for file: {filename}")
    return resolved


def read_json(filename: str) -> Any:
    path = _safe_path(filename)
    with _lock:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)


def write_json(filename: str, data: Any) -> None:
    path = _safe_path(filename)
    with _lock:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
