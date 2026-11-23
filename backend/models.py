"""Pydantic and data schemas for agent queries, SPARQL execution, and responses."""

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field

# ---------------------------------------------------------
# Agent API Models
# ---------------------------------------------------------


class AgentQueryRequest(BaseModel):
    """User question submitted to the natural language agent."""

    question: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural language question about the MovieLens knowledge graph.",
    )


class AgentQueryResponse(BaseModel):
    """Structured response returned by the agent."""

    question: str
    answer: str
    answer_source: str
    generated_sparql: str | None = None
    query_rationale: str = ""
    result_count: int = 0
    results: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------
# Streaming & Progress Events
# ---------------------------------------------------------


@dataclass(frozen=True)
class ProgressEvent:
    """A progress notification emitted during a multi-step agent run."""

    stage: str
    state: str  # "start" or "done"
    detail: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------
# SPARQL Query Models
# ---------------------------------------------------------


@dataclass(frozen=True)
class SparqlProposal:
    """Output from the LLM SPARQL generation step."""

    answerable: bool
    rationale: str
    sparql: str | None


@dataclass(frozen=True)
class ValidatedQuery:
    """A sanitized and validated SPARQL SELECT query safe to execute."""

    text: str
    limit: int


@dataclass(frozen=True)
class QueryResult:
    """Tabular query results returned from the SPARQL endpoint."""

    variables: tuple[str, ...]
    records: tuple[dict[str, Any], ...]
    truncated: bool = False


# ---------------------------------------------------------
# Settings Administration Models
# ---------------------------------------------------------


class PinVerifyRequest(BaseModel):
    pin: str = Field(..., min_length=6, max_length=6)


class LlmSettingsUpdateRequest(BaseModel):
    base_url: str
    model: str
    api_key: str | None = None


class LlmTestRequest(BaseModel):
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
