"""SQLite storage for persistent application settings and LLM configuration."""

import logging
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path("data/settings.db")


def get_db_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Ensures parent directory exists and connects to SQLite database."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_settings_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Creates the settings table if it does not exist."""
    with get_db_connection(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def get_setting(
    key: str, default: str | None = None, db_path: Path = DEFAULT_DB_PATH
) -> str | None:
    """Retrieves a single setting value by key."""
    try:
        with get_db_connection(db_path) as conn:
            row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
            if row:
                return str(row["value"])
    except sqlite3.OperationalError:
        pass
    return default


def get_all_settings(db_path: Path = DEFAULT_DB_PATH) -> dict[str, str]:
    """Retrieves all persisted settings as a key-value dictionary."""
    try:
        with get_db_connection(db_path) as conn:
            rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
            return {row["key"]: row["value"] for row in rows}
    except sqlite3.OperationalError:
        return {}


def save_settings(updates: dict[str, str], db_path: Path = DEFAULT_DB_PATH) -> None:
    """Inserts or updates multiple settings atomically in SQLite."""
    init_settings_db(db_path)
    now = datetime.now(UTC).isoformat()
    with get_db_connection(db_path) as conn:
        for key, val in updates.items():
            conn.execute(
                """
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (key, val, now),
            )
        conn.commit()


def fetch_or_copy_sample_dataset(target_dir: Path) -> dict[str, str]:
    """Ensures MovieLens CSVs are present in target_dir from local datasets/ or GroupLens."""
    import io
    import shutil
    import zipfile

    import httpx

    target_dir.mkdir(parents=True, exist_ok=True)
    local_source = Path("datasets/ml-latest-small")
    if local_source.exists() and (local_source / "movies.csv").exists():
        for fname in ["movies.csv", "ratings.csv", "tags.csv", "links.csv"]:
            src = local_source / fname
            if src.exists():
                shutil.copy2(src, target_dir / fname)
        return {"upload_id": target_dir.name, "status": "ready", "source": "local"}

    url = "https://files.grouplens.org/datasets/movielens/ml-latest-small.zip"
    resp = httpx.get(url, timeout=45.0, headers={"User-Agent": "MovieLens-Agent/0.1"})
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for member in zf.namelist():
            name = Path(member).name
            if name in ("movies.csv", "ratings.csv", "tags.csv", "links.csv"):
                (target_dir / name).write_bytes(zf.read(member))
    return {"upload_id": target_dir.name, "status": "ready", "source": "downloaded"}


def load_persisted_settings(target_settings: object) -> None:
    """Loads saved settings from SQLite into the in-memory settings singleton."""
    from pydantic import SecretStr

    saved = get_all_settings(getattr(target_settings, "settings_db_path", DEFAULT_DB_PATH))
    if saved.get("llm_base_url"):
        target_settings.llm_base_url = saved["llm_base_url"]  # type: ignore[attr-defined]
    if saved.get("llm_model"):
        target_settings.llm_model = saved["llm_model"]  # type: ignore[attr-defined]
    if saved.get("llm_api_key"):
        target_settings.llm_api_key = SecretStr(saved["llm_api_key"])  # type: ignore[attr-defined]
