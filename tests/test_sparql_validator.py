"""Tests for SPARQL query safety, security checks, and LIMIT injection."""

import pytest
from backend.sparql_validator import QueryValidationError, SparqlValidator


def test_validator_accepts_valid_query():
    validator = SparqlValidator(default_limit=25, max_limit=100)
    query = "SELECT ?title WHERE { ?m <https://example.org/movielens/title> ?title } LIMIT 10"
    validated = validator.validate(query)
    assert validated.limit == 10
    assert "LIMIT 10" in validated.text


def test_validator_appends_default_limit():
    validator = SparqlValidator(default_limit=30, max_limit=100)
    query = "SELECT ?title WHERE { ?m <https://example.org/movielens/title> ?title }"
    validated = validator.validate(query)
    assert validated.limit == 30
    assert "LIMIT 30" in validated.text


def test_validator_clamps_excessive_limit():
    validator = SparqlValidator(default_limit=20, max_limit=50)
    query = "SELECT ?title WHERE { ?m <https://example.org/movielens/title> ?title } LIMIT 1000"
    validated = validator.validate(query)
    assert validated.limit == 50
    assert "LIMIT 50" in validated.text


@pytest.mark.parametrize(
    "forbidden",
    [
        "DROP GRAPH <https://example.org/movielens>",
        "INSERT DATA { <x> <y> <z> }",
        "DELETE WHERE { ?s ?p ?o }",
        "SELECT * WHERE { SERVICE <http://external.org/sparql> { ?s ?p ?o } }",
        "SELECT * FROM NAMED <http://external.org/graph> WHERE { ?s ?p ?o }",
        "CLEAR ALL",
    ],
)
def test_validator_rejects_unsafe_operations(forbidden: str):
    validator = SparqlValidator()
    with pytest.raises(QueryValidationError):
        validator.validate(forbidden)


def test_validator_rejects_empty_query():
    validator = SparqlValidator()
    with pytest.raises(QueryValidationError):
        validator.validate("   ")
