# Architecture Decision Records (ADRs)

This document records key technical decisions made during the design and development of the MovieLens Knowledge Graph Agent.

| ID | Decision | Status | Summary |
|---|---|---|---|
| **ADR-001** | Python 3.12 with `uv` lockfile | Accepted | Ensures reproducible builds across developer environments, Docker, and CI. |
| **ADR-002** | Apache Jena Fuseki 6.2.0 + TDB2 | Accepted | Uses persistent on-disk TDB2 storage and a standard SPARQL 1.1 protocol endpoint. |
| **ADR-003** | Query-only Fuseki configuration | Accepted | Blocks update operations at the Fuseki server level and enforces query timeouts. |
| **ADR-004** | Caddy reverse proxy | Accepted | Unified gateway for web, API, and SPARQL routing with automatic HTTPS. |
| **ADR-005** | Namespace placeholder | Accepted | Uses `https://example.org/movielens/` as a clean, configurable namespace. |
| **ADR-006** | Turtle as RDF serialization format | Accepted | Human-readable, widely supported RDF syntax for import and export. |
| **ADR-007** | Stable slug IRIs for entities | Accepted | Slugified entity IRIs (`ml:movie/1`, `ml:genre/sci-fi`) for deterministic references. |
| **ADR-008** | Precomputed movie rating metrics | Accepted | Precalculates `ml:averageRating` and `ml:ratingCount` during ingestion for fast queries. |
| **ADR-009** | External IDs stored without scraping | Accepted | Stores IMDb/TMDb IDs as literal identifiers without external web scraping. |
| **ADR-010** | OpenAI-compatible LLM provider API | Accepted | Works with any provider (OpenRouter, OpenAI, Local Ollama, vLLM). |
| **ADR-011** | Grounded answer generation | Accepted | LLM synthesizes answers strictly using retrieved SPARQL tabular result rows. |
| **ADR-012** | AST-based SPARQL query validation | Accepted | Parses query syntax trees using RDFLib to prevent prompt injection and federation. |
| **ADR-013** | Server-Sent Events (SSE) streaming | Accepted | Streams multi-stage agent pipeline progress (`analyzing`, `generating`, `executing`). |
| **ADR-014** | Interactive Web Frontend | Accepted | Modern React 19 single-page app with Cytoscape.js topology and Tailwind CSS. |

---

## Details of Key Decisions

### ADR-002: Apache Jena Fuseki + TDB2
- **Context**: Persistent graph storage is required to execute SPARQL queries efficiently.
- **Decision**: Use Apache Jena Fuseki 6.2.0 with a persistent TDB2 storage volume. Offline bulk loading is handled via `tdb2.tdbloader` inside the container.
- **Consequences**: Persistent, zero-maintenance storage that survives container rebuilds.

### ADR-008: Precomputed Rating Statistics
- **Context**: Aggregating millions of rating triples on-the-fly inside SPARQL can introduce latency during interactive exploration.
- **Decision**: Calculate total rating counts and average ratings in memory during CSV ingestion and attach them as properties (`ml:ratingCount`, `ml:averageRating`) on each `ml:Movie` node.
- **Consequences**: Complex filtering queries (e.g., *"Top movies with at least 50 ratings"*) execute in single-digit milliseconds.

### ADR-012: Query Safety & AST Validation
- **Context**: Generated SPARQL from LLMs cannot be trusted blindly.
- **Decision**: Validate generated queries through RDFLib's SPARQL 1.1 parser. Disallow mutating statements (`INSERT`, `DELETE`, `DROP`), block remote federation (`SERVICE`), and automatically inject/clamp `LIMIT` clauses.
- **Consequences**: Completely prevents malicious queries and unconstrained result dumps from impacting database stability.

### ADR-014: Interactive Web Frontend
- **Context**: Users and researchers need a visual way to explore the graph, test the agent, and inspect query results.
- **Decision**: Build a modern React 19 application using Vite, TypeScript, Tailwind CSS, and Cytoscape.js. Features include an interactive AI Agent demo, movie catalog with filters, visual neighborhood graphs, and a read-only SPARQL console.
