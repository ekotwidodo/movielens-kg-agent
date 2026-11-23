"""Application configuration and environment settings.

Loads configuration from environment variables and an optional .env file.
Uses Pydantic Settings for type validation and default values.
"""

from pathlib import Path

from pydantic import AnyHttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the MovieLens KG Agent backend."""

    # Apache Jena Fuseki SPARQL query endpoint
    fuseki_query_endpoint: AnyHttpUrl = AnyHttpUrl("http://fuseki:3030/movielens/sparql")

    # LLM Provider settings (OpenAI-compatible chat completion API)
    llm_provider: str = "openai-compatible"
    llm_base_url: AnyHttpUrl = AnyHttpUrl("https://openrouter.ai/api/v1")
    llm_model: str = "inclusionai/ling-3.2-flash:free"
    llm_api_key: SecretStr | None = None

    # Knowledge Graph vocabulary namespace
    movielens_namespace: str = "https://example.org/movielens/"

    # Query execution limits
    sparql_query_timeout_seconds: float = 15.0
    max_result_rows: int = 50
    default_query_limit: int = 50
    max_query_limit: int = 500

    # 6-digit administration PIN for the settings & ingestion dashboard
    settings_admin_pin: str = "123456"

    # Directory paths for uploaded CSVs, generated graphs, reports, and SQLite settings
    data_upload_dir: Path = Path("data/uploads")
    graph_output_path: Path = Path("data/processed/movielens.ttl")
    report_output_path: Path = Path("data/reports/import-report.json")
    settings_db_path: Path = Path("data/settings.db")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


# Singleton instance loaded once at application startup
settings = Settings()
