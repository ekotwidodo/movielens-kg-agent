"""Tests for API routes and controllers."""

from unittest.mock import patch

import pytest
from backend.api import create_app
from backend.models import AgentQueryResponse
from backend.settings_store import get_all_settings, save_settings
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_health_live(client):
    res = client.get("/health/live")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_ready_available(client):
    with patch("api.FusekiClient.is_available", return_value=True):
        res = client.get("/health/ready")
        assert res.status_code == 200
        assert res.json()["status"] == "ready"


def test_health_ready_unavailable(client):
    with patch("api.FusekiClient.is_available", return_value=False):
        res = client.get("/health/ready")
        assert res.status_code == 503
        assert res.json()["status"] == "not_ready"


def test_stats_endpoint(client):
    res = client.get("/api/v1/stats")
    assert res.status_code == 200
    data = res.json()
    assert "movies" in data
    assert "ratings" in data
    assert "users" in data


def test_settings_pin_verification(client):
    # Default PIN is 123456
    res_ok = client.post("/api/v1/settings/verify-pin", json={"pin": "123456"})
    assert res_ok.status_code == 200
    assert res_ok.json()["valid"] is True

    res_fail = client.post("/api/v1/settings/verify-pin", json={"pin": "000000"})
    assert res_fail.status_code == 401


def test_sqlite_settings_store(tmp_path):
    db_file = tmp_path / "test_settings.db"
    save_settings(
        {"llm_model": "gpt-4o", "llm_base_url": "https://api.openai.com/v1"},
        db_path=db_file,
    )

    stored = get_all_settings(db_path=db_file)
    assert stored["llm_model"] == "gpt-4o"
    assert stored["llm_base_url"] == "https://api.openai.com/v1"

    # Update an existing key
    save_settings({"llm_model": "claude-3-5"}, db_path=db_file)
    updated = get_all_settings(db_path=db_file)
    assert updated["llm_model"] == "claude-3-5"


def test_settings_llm_endpoints(client):
    headers = {"X-Settings-Pin": "123456"}

    # Get settings
    get_res = client.get("/api/v1/settings/llm", headers=headers)
    assert get_res.status_code == 200
    assert "base_url" in get_res.json()

    # Update settings
    with patch("backend.api.save_settings") as mock_save:
        update_res = client.post(
            "/api/v1/settings/llm",
            json={
                "base_url": "https://new-api.test/v1",
                "model": "new-model",
                "api_key": "sk-12345678",
            },
            headers=headers,
        )
        assert update_res.status_code == 200
        mock_save.assert_called_once()


def test_agent_query_endpoint(client):
    fake_response = AgentQueryResponse(
        question="Find comedies",
        answer="Found 1 comedy.",
        answer_source="llm_synthesized",
        result_count=1,
        results=[{"title": "Toy Story"}],
    )
    with patch("api.KnowledgeGraphAgent.answer_question", return_value=fake_response):
        res = client.post("/api/v1/agent/query", json={"question": "Find comedies"})
        assert res.status_code == 200
        assert res.json()["answer"] == "Found 1 comedy."
        assert res.json()["result_count"] == 1


def test_agent_stream_endpoint(client):
    fake_response = AgentQueryResponse(
        question="Find comedies",
        answer="Found comedies.",
        answer_source="llm_synthesized",
        result_count=1,
        results=[{"title": "Toy Story"}],
    )
    with patch("api.KnowledgeGraphAgent.answer_question", return_value=fake_response):
        res = client.post("/api/v1/agent/query/stream", json={"question": "Find comedies"})
        assert res.status_code == 200
        assert "text/event-stream" in res.headers["content-type"]
        text = res.text
        assert "result" in text


def test_dataset_upload_and_transform_endpoints(client, tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "graph_output_path", tmp_path / "test.ttl")
    monkeypatch.setattr(settings, "report_output_path", tmp_path / "test-report.json")

    headers = {"X-Settings-Pin": "123456"}
    files = [
        (
            "files",
            ("movies.csv", b"movieId,title,genres\n1,Toy Story,Animation|Comedy\n", "text/csv"),
        ),
        (
            "files",
            ("ratings.csv", b"userId,movieId,rating,timestamp\n1,1,5.0,964982703\n", "text/csv"),
        ),
    ]
    # Test /upload route
    res = client.post("/api/v1/settings/upload", files=files, headers=headers)
    assert res.status_code == 200
    upload_id = res.json()["upload_id"]
    assert upload_id

    # Test /transform/stream route
    stream_res = client.post(
        "/api/v1/settings/transform/stream",
        json={"upload_id": upload_id, "strict": False},
        headers=headers,
    )
    assert stream_res.status_code == 200
    assert "text/event-stream" in stream_res.headers["content-type"]
    assert "complete" in stream_res.text


def test_dataset_sample_endpoint(client, monkeypatch, tmp_path):
    headers = {"X-Settings-Pin": "123456"}
    # Mock fetch_or_copy_sample_dataset
    monkeypatch.setattr(
        "backend.api.fetch_or_copy_sample_dataset",
        lambda _target: {"upload_id": "sample-test", "status": "ready", "source": "mock"},
    )
    res = client.post("/api/v1/settings/dataset/sample", headers=headers)
    assert res.status_code == 200
    assert res.json()["upload_id"] == "sample-test"
