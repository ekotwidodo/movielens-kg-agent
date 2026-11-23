"""Pytest configuration and common fixtures."""

from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = PROJECT_ROOT / "tests" / "fixtures" / "movielens"
NAMESPACE = "https://example.org/movielens/"


@pytest.fixture
def fixture_dir() -> Path:
    return FIXTURE_DIR
