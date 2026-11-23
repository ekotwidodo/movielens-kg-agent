"""Knowledge Graph Builder: Converts parsed MovieLens dataset into RDF Triples (Turtle)."""

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from rdflib import RDF, RDFS, XSD, Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS

from backend.dataset import ParsedDataset

logger = logging.getLogger(__name__)


class KnowledgeGraphBuilder:
    """Builds an RDF knowledge graph conforming to the MovieLens ontology."""

    def __init__(self, base_namespace: str = "https://example.org/movielens/") -> None:
        self.base_ns = base_namespace.rstrip("/") + "/"
        self.ML = Namespace(self.base_ns)

    def _clean_slug(self, text: str) -> str:
        """Convert arbitrary strings (genres/tags) to URI-safe slugs."""
        return text.lower().replace(" ", "-").replace("'", "").replace("&", "and")

    def build_graph(self, dataset: ParsedDataset) -> Graph:
        """Transforms in-memory dataset records into an RDFLib Graph with triples."""
        graph = Graph()

        # Bind standard and custom prefixes
        graph.bind("ml", self.ML)
        graph.bind("dct", DCTERMS)
        graph.bind("rdfs", RDFS)
        graph.bind("xsd", XSD)

        # 1. Add Ontology Schema Triples
        graph.add((self.ML.Movie, RDF.type, RDFS.Class))
        graph.add((self.ML.Movie, RDFS.label, Literal("Movie")))
        graph.add((self.ML.Genre, RDF.type, RDFS.Class))
        graph.add((self.ML.User, RDF.type, RDFS.Class))
        graph.add((self.ML.RatingEvent, RDF.type, RDFS.Class))
        graph.add((self.ML.TagAssignment, RDF.type, RDFS.Class))

        # 2. Add Genres
        for genre_name in dataset.genre_names:
            slug = self._clean_slug(genre_name)
            genre_uri = URIRef(f"{self.base_ns}genre/{slug}")
            graph.add((genre_uri, RDF.type, self.ML.Genre))
            graph.add((genre_uri, self.ML.genreLabel, Literal(genre_name)))

        # 3. Add Movies
        for movie in dataset.movies.values():
            movie_uri = URIRef(f"{self.base_ns}movie/{movie.movie_id}")
            graph.add((movie_uri, RDF.type, self.ML.Movie))
            graph.add((movie_uri, self.ML.movieId, Literal(movie.movie_id, datatype=XSD.integer)))
            graph.add((movie_uri, self.ML.title, Literal(movie.title)))

            if movie.rating_count > 0:
                graph.add(
                    (
                        movie_uri,
                        self.ML.ratingCount,
                        Literal(movie.rating_count, datatype=XSD.integer),
                    )
                )
                graph.add(
                    (
                        movie_uri,
                        self.ML.averageRating,
                        Literal(movie.average_rating, datatype=XSD.decimal),
                    )
                )

            if movie.imdb_id:
                graph.add((movie_uri, self.ML.imdbId, Literal(movie.imdb_id)))
            if movie.tmdb_id:
                graph.add((movie_uri, self.ML.tmdbId, Literal(movie.tmdb_id)))

            for g_name in movie.genres:
                slug = self._clean_slug(g_name)
                genre_uri = URIRef(f"{self.base_ns}genre/{slug}")
                graph.add((movie_uri, self.ML.hasGenre, genre_uri))

        # 4. Add Users
        for u_id in dataset.user_ids:
            user_uri = URIRef(f"{self.base_ns}user/{u_id}")
            graph.add((user_uri, RDF.type, self.ML.User))
            graph.add((user_uri, self.ML.userId, Literal(u_id, datatype=XSD.integer)))

        # 5. Add Ratings (up to reasonable density for graph size)
        for idx, rating in enumerate(dataset.ratings):
            r_uri = URIRef(f"{self.base_ns}rating/{idx + 1}")
            user_uri = URIRef(f"{self.base_ns}user/{rating.user_id}")
            movie_uri = URIRef(f"{self.base_ns}movie/{rating.movie_id}")

            graph.add((r_uri, RDF.type, self.ML.RatingEvent))
            graph.add((r_uri, self.ML.ratedBy, user_uri))
            graph.add((r_uri, self.ML.ratedMovie, movie_uri))
            graph.add((r_uri, self.ML.ratingValue, Literal(rating.rating, datatype=XSD.decimal)))

        # 6. Add Tags
        for idx, tag in enumerate(dataset.tags):
            t_uri = URIRef(f"{self.base_ns}tag-assignment/{idx + 1}")
            user_uri = URIRef(f"{self.base_ns}user/{tag.user_id}")
            movie_uri = URIRef(f"{self.base_ns}movie/{tag.movie_id}")

            graph.add((t_uri, RDF.type, self.ML.TagAssignment))
            graph.add((t_uri, self.ML.taggedBy, user_uri))
            graph.add((t_uri, self.ML.taggedMovie, movie_uri))
            graph.add((t_uri, self.ML.tagText, Literal(tag.tag)))

        return graph

    def export_turtle(
        self,
        graph: Graph,
        output_path: Path,
        report_path: Path | None = None,
        dataset: ParsedDataset | None = None,
    ) -> dict[str, Any]:
        """Serializes the RDF Graph to Turtle (.ttl) format and writes import statistics."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        graph.serialize(destination=str(output_path), format="turtle")

        created: dict[str, int] = {}
        if dataset is not None:
            created = {
                "movies": len(dataset.movies),
                "rating_events": len(dataset.ratings),
                "tag_assignments": len(dataset.tags),
                "users": len(dataset.user_ids),
                "genres": len(dataset.genre_names),
            }
        else:
            created = {
                "movies": sum(1 for _ in graph.subjects(RDF.type, self.ML.Movie)),
                "rating_events": sum(1 for _ in graph.subjects(RDF.type, self.ML.RatingEvent)),
                "tag_assignments": sum(1 for _ in graph.subjects(RDF.type, self.ML.TagAssignment)),
                "users": sum(1 for _ in graph.subjects(RDF.type, self.ML.User)),
                "genres": sum(1 for _ in graph.subjects(RDF.type, self.ML.Genre)),
            }

        stats = {
            "triple_count": len(graph),
            "generated_at": datetime.now(UTC).isoformat(),
            "created_resources": created,
        }

        if report_path:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(stats, indent=2), encoding="utf-8")

        return stats
