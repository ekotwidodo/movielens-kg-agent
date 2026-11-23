"""MovieLens CSV dataset loader, validator, and aggregation processor."""

import csv
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class MovieRecord:
    movie_id: int
    title: str
    genres: list[str] = field(default_factory=list)
    rating_count: int = 0
    average_rating: float = 0.0
    imdb_id: str | None = None
    tmdb_id: str | None = None


@dataclass
class RatingRecord:
    user_id: int
    movie_id: int
    rating: float
    timestamp: int


@dataclass
class TagRecord:
    user_id: int
    movie_id: int
    tag: str
    timestamp: int


@dataclass
class ParsedDataset:
    """In-memory validated MovieLens dataset ready for RDF conversion."""

    movies: dict[int, MovieRecord] = field(default_factory=dict)
    ratings: list[RatingRecord] = field(default_factory=list)
    tags: list[TagRecord] = field(default_factory=list)
    user_ids: set[int] = field(default_factory=set)
    genre_names: set[str] = field(default_factory=set)


class DatasetLoader:
    """Parses and validates MovieLens CSV files (movies, ratings, tags, links)."""

    def load_from_directory(self, data_dir: Path, strict: bool = False) -> ParsedDataset:
        """Loads and cross-validates all CSV files present in the target folder."""
        dataset = ParsedDataset()

        # 1. Load movies.csv (Required)
        movies_path = data_dir / "movies.csv"
        if not movies_path.exists():
            raise FileNotFoundError(f"Missing required file: {movies_path}")

        with movies_path.open("r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    m_id = int(row["movieId"].strip())
                    title = row["title"].strip()
                    raw_genres = row.get("genres", "").strip()
                    genres = [
                        g.strip()
                        for g in raw_genres.split("|")
                        if g.strip() and g != "(no genres listed)"
                    ]

                    dataset.movies[m_id] = MovieRecord(movie_id=m_id, title=title, genres=genres)
                    for g in genres:
                        dataset.genre_names.add(g)
                except (KeyError, ValueError) as err:
                    if strict:
                        raise ValueError(f"Invalid row in movies.csv: {row} ({err})") from err

        # 2. Load links.csv (Optional)
        links_path = data_dir / "links.csv"
        if links_path.exists():
            with links_path.open("r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        m_id = int(row["movieId"].strip())
                        if m_id in dataset.movies:
                            dataset.movies[m_id].imdb_id = row.get("imdbId", "").strip() or None
                            dataset.movies[m_id].tmdb_id = row.get("tmdbId", "").strip() or None
                    except (KeyError, ValueError) as err:
                        if strict:
                            raise ValueError(f"Invalid row in links.csv: {row} ({err})") from err

        # 3. Load ratings.csv (Required for rating statistics)
        ratings_path = data_dir / "ratings.csv"
        if ratings_path.exists():
            movie_rating_sums: dict[int, float] = {}
            movie_rating_counts: dict[int, int] = {}

            with ratings_path.open("r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        u_id = int(row["userId"].strip())
                        m_id = int(row["movieId"].strip())
                        r_val = float(row["rating"].strip())
                        ts = int(row.get("timestamp", 0) or 0)

                        dataset.user_ids.add(u_id)
                        dataset.ratings.append(
                            RatingRecord(user_id=u_id, movie_id=m_id, rating=r_val, timestamp=ts)
                        )

                        movie_rating_sums[m_id] = movie_rating_sums.get(m_id, 0.0) + r_val
                        movie_rating_counts[m_id] = movie_rating_counts.get(m_id, 0) + 1
                    except (KeyError, ValueError) as err:
                        if strict:
                            raise ValueError(f"Invalid row in ratings.csv: {row} ({err})") from err

            # Apply aggregate statistics to movie records
            for m_id, count in movie_rating_counts.items():
                if m_id in dataset.movies:
                    dataset.movies[m_id].rating_count = count
                    dataset.movies[m_id].average_rating = round(movie_rating_sums[m_id] / count, 2)

        # 4. Load tags.csv (Optional)
        tags_path = data_dir / "tags.csv"
        if tags_path.exists():
            with tags_path.open("r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        u_id = int(row["userId"].strip())
                        m_id = int(row["movieId"].strip())
                        tag_txt = row["tag"].strip()
                        ts = int(row.get("timestamp", 0) or 0)

                        if tag_txt:
                            dataset.user_ids.add(u_id)
                            dataset.tags.append(
                                TagRecord(user_id=u_id, movie_id=m_id, tag=tag_txt, timestamp=ts)
                            )
                    except (KeyError, ValueError) as err:
                        if strict:
                            raise ValueError(f"Invalid row in tags.csv: {row} ({err})") from err

        return dataset
