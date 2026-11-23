"""Tests for the KnowledgeGraphAgent and query generation."""

import json
from unittest.mock import MagicMock, patch

import pytest
from backend.agent import KnowledgeGraphAgent
from backend.config import Settings
from backend.models import ProgressEvent, QueryResult
from backend.sparql_client import FusekiClient


@pytest.fixture
def mock_config():
    return Settings(
        llm_model="test-model",
        llm_base_url="https://mock-llm.test/v1",
        movielens_namespace="https://example.org/movielens/",
        default_query_limit=10,
        max_query_limit=50,
    )


@pytest.fixture
def mock_fuseki():
    client = MagicMock(spec=FusekiClient)
    client.execute.return_value = QueryResult(
        variables=("title", "avgRating"),
        records=(
            {"title": "Toy Story (1995)", "avgRating": 3.92},
            {"title": "Jurassic Park (1993)", "avgRating": 3.75},
        ),
        truncated=False,
    )
    client.is_available.return_value = True
    return client


def test_agent_proposal_parsing_markdown_json(mock_config, mock_fuseki):
    agent = KnowledgeGraphAgent(mock_config, fuseki_client=mock_fuseki)

    mock_llm_json = """```json
    {
        "answerable": true,
        "rationale": "Filter movies by genre Sci-Fi",
        "sparql": "PREFIX ml: <https://example.org/movielens/> SELECT ?title WHERE { ?m ml:title ?title } LIMIT 10"
    }
    ```"""

    with patch.object(agent, "_call_llm", return_value=mock_llm_json):
        proposal = agent.generate_sparql_proposal("Find Sci-Fi movies")
        assert proposal.answerable is True
        assert "Sci-Fi" in proposal.rationale
        assert "SELECT ?title" in proposal.sparql


def test_agent_proposal_fallback_raw_select(mock_config, mock_fuseki):
    agent = KnowledgeGraphAgent(mock_config, fuseki_client=mock_fuseki)
    raw_sparql = "SELECT ?title WHERE { ?m <https://example.org/movielens/title> ?title } LIMIT 5"

    with patch.object(agent, "_call_llm", return_value=raw_sparql):
        proposal = agent.generate_sparql_proposal("List movies")
        assert proposal.answerable is True
        assert "SELECT ?title" in proposal.sparql


def test_agent_full_pipeline_success(mock_config, mock_fuseki):
    agent = KnowledgeGraphAgent(mock_config, fuseki_client=mock_fuseki)

    llm_proposal_json = json.dumps(
        {
            "answerable": True,
            "rationale": "Get top rated movies",
            "sparql": "PREFIX ml: <https://example.org/movielens/> SELECT ?title WHERE { ?m ml:title ?title } LIMIT 5",
        }
    )

    events: list[ProgressEvent] = []

    def on_progress(event: ProgressEvent):
        events.append(event)

    # First call generates proposal, second call generates grounded answer
    with patch.object(
        agent,
        "_call_llm",
        side_effect=[llm_proposal_json, "Toy Story and Jurassic Park are top rated."],
    ):
        response = agent.answer_question("What are the top movies?", on_progress=on_progress)

        assert response.result_count == 2
        assert "Toy Story" in response.answer
        assert response.answer_source == "llm_synthesized"
        assert len(events) >= 5
        stages = [e.stage for e in events]
        assert "analyzing" in stages
        assert "generating_sparql" in stages
        assert "validating" in stages
        assert "executing" in stages
        assert "answering" in stages


def test_agent_unanswerable_question(mock_config, mock_fuseki):
    agent = KnowledgeGraphAgent(mock_config, fuseki_client=mock_fuseki)
    unanswerable_json = json.dumps(
        {
            "answerable": False,
            "rationale": "Weather data is not in the MovieLens graph.",
            "sparql": None,
        }
    )

    with patch.object(agent, "_call_llm", return_value=unanswerable_json):
        response = agent.answer_question("What is the weather in Tokyo?")
        assert response.result_count == 0
        assert response.answer_source == "unanswerable"
        assert "could not answer" in response.answer.lower()
