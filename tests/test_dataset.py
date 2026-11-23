"""Tests for MovieLens CSV parsing, schema validation, and rating aggregation."""

from pathlib import Path

import pytest
from backend.dataset import DatasetLoader

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "movielens"


def test_dataset_loader_loads_all_files():
    loader = DatasetLoader()
    dataset = loader.load_from_directory(FIXTURE_DIR)

    assert len(dataset.movies) > 0
    assert len(dataset.ratings) > 0
    assert len(dataset.tags) > 0
    assert len(dataset.genre_names) > 0
    assert len(dataset.user_ids) > 0

    # Verify movie record attributes
    toy_story = next(m for m in dataset.movies.values() if "Toy Story" in m.title)
    assert toy_story.movie_id == 1
    assert "Adventure" in toy_story.genres
    assert "Animation" in toy_story.genres
    assert toy_story.rating_count > 0
    assert toy_story.average_rating > 0.0


def test_dataset_loader_missing_movies_raises():
    loader = DatasetLoader()
    with pytest.raises(FileNotFoundError):
        loader.load_from_directory(Path("non_existent_directory"))


def test_dataset_strict_mode(tmp_path: Path):
    # Create invalid CSV row with bad movieId
    movies_file = tmp_path / "movies.csv"
    movies_file.write_text("movieId,title,genres\ninvalid_id,Test Movie,Action\n", encoding="utf-8")

    loader = DatasetLoader()
    # In non-strict mode, it skips bad rows
    dataset = loader.load_from_directory(tmp_path, strict=False)
    assert len(dataset.movies) == 0

    # In strict mode, it raises ValueError
    with pytest.raises(ValueError):
        loader.load_from_directory(tmp_path, strict=True)
