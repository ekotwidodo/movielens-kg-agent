# API Reference

Base URL (public demo): `https://movielens-knowledge.graphs.web.id`
Interactive docs: `/api/docs` (OpenAPI JSON: `/api/openapi.json`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/agent/query` | Submit natural-language question; receive grounded answer, SPARQL, and rows |
| `POST` | `/api/v1/agent/query/stream` | Stream reasoning pipeline progress and results via Server-Sent Events (SSE) |
| `GET` | `/api/v1/stats` | Retrieve cached entity counts (movies, ratings, users, triples) |
| `GET` | `/health/live` | Liveness check (verifies FastAPI process is running) |
| `GET` | `/health/ready` | Readiness check (verifies Apache Jena Fuseki is reachable) |
| `GET`/`POST` | `/sparql` | Read-only SPARQL Protocol endpoint (served by Fuseki via reverse proxy) |

The health endpoints are for the container runtime and are not routed by the
public proxy.

Every response has an `X-Request-ID` header. You may send your own
`X-Request-ID` (letters, digits, `.`, `_`, `-`, up to 64 characters).

## POST /api/v1/agent/query

### Request

```json
{ "question": "What are the top five movies by average rating among movies with at least 50 ratings?" }
```

- `question` is required, must not be empty, and is at most
  `AGENT_MAX_QUESTION_LENGTH` characters (default 2,000).
- Unknown fields are rejected.

### Success response (200)

```json
{
  "question": "What are the top five movies by average rating among movies with at least 50 ratings?",
  "answer": "The knowledge graph returned 5 records:\n- title: Shawshank Redemption, The (1994), averageRating: 4.43, ratingCount: 317\n- title: Godfather, The (1972), averageRating: 4.29, ratingCount: 192\n- ...",
  "answer_source": "template",
  "generated_sparql": "PREFIX ml: <https://example.org/movielens/>\nSELECT ?title (AVG(?value) AS ?averageRating) ...\nLIMIT 5",
  "query_rationale": "Groups rating events per movie, keeps movies with at least 50 ratings, and orders by average.",
  "result_count": 5,
  "variables": ["title", "averageRating", "ratingCount"],
  "results": [
    { "title": "Shawshank Redemption, The (1994)", "averageRating": "4.429022082018927444794953", "ratingCount": 317 },
    { "title": "Godfather, The (1972)", "averageRating": "4.2890625", "ratingCount": 192 }
  ],
  "dataset": { "name": "MovieLens Latest Small", "snapshot_id": "ml-latest-small-2026-11-17" },
  "warnings": []
}
```

(Values from `ml-latest-small`; `results` is shortened here. The query rationale is written by the LLM.)

| Field | Meaning |
|---|---|
| `answer` | Natural-language answer built **only** from `results` |
| `answer_source` | `template` (fixed wording around the rows), `language_model` (LLM summary of the rows only), or `not_answerable` |
| `generated_sparql` | The exact query that was validated and executed, so it can be re-run at `/sparql`. `null` if the question cannot be answered with the vocabulary |
| `query_rationale` | Short explanation from the query generator |
| `variables`, `results` | The SPARQL result. Integers and booleans are JSON numbers/booleans; decimals stay strings (no precision lost); IRIs are strings; unbound values are `null` |
| `dataset` | Name and snapshot ID of the loaded graph, read from its `ml:DatasetSnapshot` |
| `warnings` | `NO_RESULTS`, `RESULTS_TRUNCATED`, `QUESTION_NOT_ANSWERABLE`, `DATASET_METADATA_UNAVAILABLE` |

When nothing matches, the answer says: *"No matching records were found in the
current knowledge graph. This only describes the loaded MovieLens data, not the
real world."*

When the question needs data the graph does not have (actors, directors, plot,
box office, ...), the response has `generated_sparql: null`, the warning
`QUESTION_NOT_ANSWERABLE`, and an explanation in `answer`.

### Error response

All errors use one envelope:

```json
{
  "error": {
    "code": "SPARQL_VALIDATION_FAILED",
    "message": "The generated query did not satisfy the supported query policy.",
    "request_id": "3f0c9a1e5b8d4c2f9e7a6b5c4d3e2f1a",
    "details": {
      "reason": "SERVICE_NOT_ALLOWED",
      "detail": "SERVICE is not allowed",
      "generated_sparql": "SELECT * WHERE { SERVICE <http://...> { ?s ?p ?o } } LIMIT 5"
    }
  }
}
```

| HTTP | `code` | When |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Empty, too long, or malformed request |
| 422 | `SPARQL_VALIDATION_FAILED` | The generated query broke the query policy (it was **not** executed). `details.reason` tells why |
| 422 | `SPARQL_QUERY_REJECTED` | Fuseki refused the query (e.g. invalid grouping) |
| 502 | `LLM_UNAVAILABLE` | LLM provider unreachable, rate limited, or returned an error status |
| 502 | `LLM_INVALID_RESPONSE` | LLM output was not the requested JSON structure |
| 503 | `KNOWLEDGE_GRAPH_UNAVAILABLE` | Fuseki is unreachable or returned an unexpected response |
| 504 | `LLM_TIMEOUT` | The LLM did not answer within `LLM_TIMEOUT_SECONDS` |
| 504 | `QUERY_TIMEOUT` | The query exceeded the time limit |
| 500 | `INTERNAL_ERROR` | Unexpected error (details only in server logs) |

Error messages never contain API keys, stack traces, settings, or file paths.

#### `details.reason` values for `SPARQL_VALIDATION_FAILED`

| Reason | Meaning |
|---|---|
| `QUERY_TOO_LONG` | Longer than `SPARQL_MAX_QUERY_LENGTH` (default 20,000) |
| `MALFORMED_QUERY` | Syntax error, undefined prefix, or more than one statement |
| `UPDATE_NOT_ALLOWED` | `INSERT`, `DELETE`, `LOAD`, `CLEAR`, `CREATE`, `DROP`, `COPY`, `MOVE`, `ADD` |
| `QUERY_FORM_NOT_ALLOWED` | `ASK`, `CONSTRUCT`, or `DESCRIBE` |
| `SERVICE_NOT_ALLOWED` | `SERVICE` anywhere in the query, including subqueries |
| `DATASET_CLAUSE_NOT_ALLOWED` | `FROM` or `FROM NAMED` |
| `LIMIT_MISSING` | No `LIMIT` on the outer query |
| `LIMIT_TOO_LARGE` | `LIMIT` above `SPARQL_MAX_RESULT_ROWS` (default 100) |
| `OFFSET_NOT_ALLOWED` | `OFFSET` is not supported in this release |

## Health

```bash
curl http://127.0.0.1:2003/health/live    # {"status":"ok"}
curl http://127.0.0.1:2003/health/ready   # {"status":"ready","checks":{"knowledge_graph":"ok"}}
```

`/health/ready` returns HTTP 503 with `"status": "not_ready"` when Fuseki is
not reachable. (Port 2003 is only published with `docker-compose.dev.yml`.)

## Example

```bash
curl -s http://127.0.0.1:2001/api/v1/agent/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "Which tags did users give to Toy Story?"}'
```
