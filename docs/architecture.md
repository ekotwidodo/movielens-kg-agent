# System Architecture

This document outlines the architecture of the MovieLens Knowledge Graph AI Agent, including the data ingestion pipeline, SPARQL validation safeguards, the LLM agent flow, and runtime container services.

---

## 1. High-Level Architecture

The system consists of two primary subsystems:
1. **Knowledge Graph Construction Pipeline**: Ingests MovieLens CSV datasets, computes movie rating statistics, builds an RDF graph using RDFLib, and stores it in an Apache Jena TDB2 persistent graph database served by Fuseki.
2. **Grounded AI Agent & Web Application**: Provides a natural language interface that translates questions into validated SPARQL queries, retrieves factual graph rows from Fuseki, and synthesizes grounded answers.

```mermaid
flowchart LR
    subgraph Data Layer
        CSV[MovieLens CSVs] --> Builder[kg_builder.py]
        Builder --> TTL[movielens.ttl]
        TTL --> TDB2[(Apache Jena TDB2)]
        TDB2 --> Fuseki[Jena Fuseki SPARQL Endpoint]
    end

    subgraph Backend API
        UserQuery[User Question] --> Agent[agent.py]
        Agent --> Validator[sparql_validator.py]
        Validator --> Client[sparql_client.py]
        Client --> Fuseki
        Fuseki --> Client
        Client --> Agent
        Agent --> GroundedAnswer[Grounded Answer & Facts]
    end

    subgraph Frontend Web App
        Browser[React 19 SPA] <--> API[FastAPI Server]
        Browser <--> Caddy[Caddy Reverse Proxy]
    end
```

---

## 2. Backend Modules & Responsibilities

The backend is built with a flat, modular structure where each module has a clear and focused responsibility:

| Module | File | Responsibility |
|---|---|---|
| **Agent** | `backend/agent.py` | Orchestrates LLM prompt creation, SPARQL generation, validation calls, and final answer synthesis. |
| **API** | `backend/api.py` | FastAPI application exposing agent endpoints, Server-Sent Events (SSE) streaming, stats, and admin settings. |
| **Dataset Loader** | `backend/dataset.py` | Parses MovieLens CSV files (`movies.csv`, `ratings.csv`, `tags.csv`, `links.csv`), checks schema, and aggregates movie ratings. |
| **Graph Builder** | `backend/kg_builder.py` | Converts parsed in-memory entities into RDF triples using RDFLib and serializes to Turtle format (`.ttl`). |
| **SPARQL Client** | `backend/sparql_client.py` | Executes validated SELECT queries against Apache Jena Fuseki over HTTP and normalizes JSON results. |
| **Query Validator** | `backend/sparql_validator.py` | Enforces read-only safety, blocks harmful operations (`SERVICE`, `INSERT`, `DELETE`), and ensures `LIMIT` clauses. |
| **Settings** | `backend/config.py` | Centralized application configuration using Pydantic Settings and environment variables. |
| **CLI** | `backend/cli.py` | Command-line scripts for dataset validation (`mlkg-validate-dataset`) and graph construction (`mlkg-build-graph`). |

---

## 3. Knowledge Graph Construction Flow

```mermaid
flowchart TD
    A[datasets/ml-latest-small/*.csv] --> B[dataset.py: DatasetLoader]
    B -->|Validated Records & Aggregated Stats| C[kg_builder.py: KnowledgeGraphBuilder]
    C -->|RDFLib Triples| D[data/processed/movielens.ttl]
    C -->|Import Statistics| E[data/reports/import-report.json]
    D --> F[kg-loader: tdb2.tdbloader]
    F --> G[(Apache Jena TDB2 Storage)]
    G --> H[Fuseki Read-Only SPARQL Endpoint]
```

### Ingestion Details
- **Rating Aggregations**: During CSV loading, movie ratings are aggregated in memory to precalculate `ml:ratingCount` and `ml:averageRating` (rounded to 2 decimal places).
- **Turtle Output**: Triples are exported with standard prefixes (`ml:`, `rdf:`, `rdfs:`, `xsd:`, `dct:`).
- **Import Report**: A JSON summary containing total triple count and timestamps is saved for zero-latency dashboard stats.

---

## 4. Grounded AI Agent Execution Flow

Every request to `/api/v1/agent/query` follows a strictly bounded 5-stage pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor User as Web Client
    participant API as FastAPI Router
    participant Agent as KnowledgeGraphAgent
    participant LLM as OpenAI-Compatible LLM
    participant Validator as SparqlValidator
    participant Fuseki as Apache Jena Fuseki

    User->>API: POST /api/v1/agent/query (Question)
    API->>Agent: answer_question(question)
    
    rect rgb(240, 248, 255)
        note over Agent,LLM: Stage 1 & 2: Interpretation & SPARQL Generation
        Agent->>LLM: Generate SPARQL proposal (Schema + Question)
        LLM-->>Agent: JSON proposal (answerable, rationale, sparql)
    end

    rect rgb(255, 250, 240)
        note over Agent,Validator: Stage 3: Query Safety & Policy Check
        Agent->>Validator: validate(sparql)
        Validator-->>Agent: ValidatedQuery (Safe, Limit Enforced)
    end

    rect rgb(240, 255, 240)
        note over Agent,Fuseki: Stage 4: Knowledge Graph Query Execution
        Agent->>Fuseki: POST /movielens/sparql
        Fuseki-->>Agent: JSON SPARQL results
    end

    rect rgb(255, 245, 245)
        note over Agent,LLM: Stage 5: Grounded Answer Synthesis
        Agent->>LLM: Synthesize factual answer based strictly on rows
        LLM-->>Agent: Natural English answer
    end

    Agent-->>API: AgentQueryResponse (Answer, SPARQL, Rows)
    API-->>User: HTTP 200 (Structured JSON response)
```

### Safety and Security Safeguards
1. **Read-Only Enforcement**: Queries containing write operations (`INSERT`, `DELETE`, `LOAD`, `CLEAR`, `DROP`, `CREATE`) are rejected before execution.
2. **Anti-Federation (`SERVICE`)**: The `SERVICE` keyword is blocked to prevent Server-Side Request Forgery (SSRF) and external network calls.
3. **Automatic `LIMIT` Enforcement**: If the generated query omits a `LIMIT`, a default limit (e.g., 50) is automatically injected. If the requested limit exceeds the maximum allowable threshold (500), it is clamped.
4. **AST Syntax Parsing**: Queries are parsed into an abstract syntax tree using RDFLib's SPARQL parser to prevent injection bypasses through string tricks or comments.

---

## 5. Runtime Services (Docker Compose)

The deployment stack is orchestrated through `docker-compose.yml`:

| Service | Container Image | Port | Description |
|---|---|---|---|
| **fuseki** | `movielens-kg-agent/fuseki:6.2.0` | Internal (`3030`) | Apache Jena Fuseki running on Java 21 serving the persistent TDB2 store. |
| **api** | `movielens-kg-agent/api:0.1.0` | Internal (`8000`) | FastAPI service serving the agent and admin endpoints. |
| **web** | `movielens-kg-agent/web:0.1.0` | Internal (`80`) | Nginx container serving the compiled React 19 single-page application. |
| **proxy** | `caddy:2.11.9-alpine` | `2001` (HTTP), `2002` (HTTPS) | Reverse proxy providing routing, TLS, and request size limiting. |
| **kg-loader** | `movielens-kg-agent/fuseki:6.2.0` | None (CLI tool) | One-shot tool for offline database loading (`tdb2.tdbloader`) and backups. |
