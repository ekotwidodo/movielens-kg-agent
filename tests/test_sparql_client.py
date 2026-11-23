"""Tests for Apache Jena Fuseki client communication and result formatting."""

from unittest.mock import MagicMock, patch

import httpx
import pytest
from backend.models import ValidatedQuery
from backend.sparql_client import FusekiClient


def test_fuseki_client_execute_success():
    client = FusekiClient(endpoint_url="http://fuseki:3030/movielens/sparql")

    mock_json = {
        "head": {"vars": ["title", "ratingCount", "isGood"]},
        "results": {
            "bindings": [
                {
                    "title": {"type": "literal", "value": "Toy Story (1995)"},
                    "ratingCount": {
                        "type": "literal",
                        "datatype": "http://www.w3.org/2001/XMLSchema#integer",
                        "value": "215",
                    },
                    "isGood": {
                        "type": "literal",
                        "datatype": "http://www.w3.org/2001/XMLSchema#boolean",
                        "value": "true",
                    },
                }
            ]
        },
    }

    mock_response = MagicMock(status_code=200)
    mock_response.json.return_value = mock_json

    with patch("httpx.Client.post", return_value=mock_response):
        query = ValidatedQuery(text="SELECT ?title ?ratingCount ?isGood WHERE { ... }", limit=10)
        result = client.execute(query)

        assert len(result.records) == 1
        record = result.records[0]
        assert record["title"] == "Toy Story (1995)"
        assert record["ratingCount"] == 215
        assert record["isGood"] is True


def test_fuseki_client_timeout_handling():
    client = FusekiClient(endpoint_url="http://fuseki:3030/movielens/sparql")

    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("timeout")):
        query = ValidatedQuery(text="SELECT * WHERE { ... }", limit=10)
        with pytest.raises(TimeoutError):
            client.execute(query)


def test_fuseki_client_error_status_handling():
    client = FusekiClient(endpoint_url="http://fuseki:3030/movielens/sparql")
    mock_response = MagicMock(status_code=500, text="Internal Server Error")

    with patch("httpx.Client.post", return_value=mock_response):
        query = ValidatedQuery(text="SELECT * WHERE { ... }", limit=10)
        with pytest.raises(RuntimeError):
            client.execute(query)
