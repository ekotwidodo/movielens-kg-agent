"""Tests for RDF Knowledge Graph generation and Turtle serialization."""

from pathlib import Path

from backend.dataset import DatasetLoader
from backend.kg_builder import KnowledgeGraphBuilder
from rdflib import RDF, Graph, Namespace

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "movielens"


def test_kg_builder_creates_expected_triples(tmp_path: Path):
    loader = DatasetLoader()
    dataset = loader.load_from_directory(FIXTURE_DIR)

    builder = KnowledgeGraphBuilder(base_namespace="https://example.org/movielens/")
    graph = builder.build_graph(dataset)

    assert len(graph) > 50

    ML = Namespace("https://example.org/movielens/")
    movies = list(graph.subjects(RDF.type, ML.Movie))
    assert len(movies) == len(dataset.movies)

    genres = list(graph.subjects(RDF.type, ML.Genre))
    assert len(genres) == len(dataset.genre_names)

    # Test Turtle serialization
    output_ttl = tmp_path / "graph.ttl"
    report_json = tmp_path / "report.json"
    stats = builder.export_turtle(graph, output_ttl, report_json)

    assert output_ttl.exists()
    assert report_json.exists()
    assert stats["triple_count"] == len(graph)

    # Verify that serialized Turtle can be re-parsed by RDFLib
    reparsed = Graph()
    reparsed.parse(str(output_ttl), format="turtle")
    assert len(reparsed) == len(graph)
