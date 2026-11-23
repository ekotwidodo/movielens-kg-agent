# Deployment and Operations

## Requirements

- Docker with Docker Compose v2
- About 2 vCPU, 4 GB RAM, and 10 GB free disk for `ml-latest-small`
  (planning guidance, not a measured target)

The Turtle file for `ml-latest-small` is about 27 MB (≈615,000 triples) and
the loaded TDB2 database is about 275 MB.

## First start

```bash
cp .env.example .env          # then set LLM_BASE_URL, LLM_MODEL, LLM_API_KEY
mkdir -p data/processed data/reports data/backups

# 1. Build the graph on the host (see README for the Python setup)
uv run mlkg-build-graph

# 2. Build images and load the graph into TDB2 (Fuseki must not be running)
docker compose build
docker compose run --rm kg-loader load

# 3. Start the services
docker compose up -d
docker compose ps
```

The `api` service reads the LLM settings from `.env`. If they are missing, the
API container exits with a message that names the missing variables; `/sparql`
keeps working.

Test the agent:

```bash
curl -s http://127.0.0.1:2001/api/v1/agent/query \
  -H 'Content-Type: application/json' \
  -d '{"question": "Which movies are in the Sci-Fi genre?"}'
```

Test the public SPARQL endpoint:

```bash
curl -G http://127.0.0.1:2001/sparql \
  -H 'Accept: application/sparql-results+json' \
  --data-urlencode 'query=PREFIX ml: <https://example.org/movielens/> SELECT (COUNT(?m) AS ?movies) WHERE { ?m a ml:Movie } LIMIT 1'
```

## Reloading the graph

TDB2 allows only one process per database, so stop Fuseki first:

```bash
uv run mlkg-build-graph
docker compose stop fuseki
docker compose run --rm kg-loader load
docker compose start fuseki
```

The loader builds a new database next to the old one and swaps them only after
a successful load. Because IRIs are stable, reloading the same data gives the
same graph.

## Backup and restore

```bash
docker compose stop fuseki
docker compose run --rm kg-loader backup             # writes data/backups/backup_*.nq.gz
docker compose run --rm kg-loader restore <file-name> # file name inside data/backups/
docker compose start fuseki
```

Do not copy the volume directory while Fuseki is running.

## Stopping

```bash
docker compose down      # keeps the graph (volume movielens_tdb2_data)
docker compose down -v   # DANGER: deletes the graph store and Caddy certificates
```

## Ports

| Host port | Service | Default binding |
|---:|---|---|
| 2001 | proxy HTTP (port 80) | `127.0.0.1` |
| 2002 | proxy HTTPS (port 443) | `127.0.0.1` |
| 2003 | API (debug only) | only with `docker-compose.dev.yml`, `127.0.0.1` |
| 2004 | Fuseki (debug only) | only with `docker-compose.dev.yml`, `127.0.0.1` |

Fuseki and the API are never published by the main Compose file. For local
debugging and for the Fuseki/end-to-end tests:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
export FUSEKI_TEST_QUERY_ENDPOINT=http://127.0.0.1:2004/movielens/sparql
export E2E_FUSEKI_QUERY_ENDPOINT=$FUSEKI_TEST_QUERY_ENDPOINT
uv run pytest -m "fuseki or e2e"
```

## Deployment smoke test

`scripts/deployment_smoke_test.sh` checks the whole Docker setup in one go,
using the small test fixture:

1. builds the images, loads the graph, and starts all services;
2. runs the `smoke` tests through the proxy (routing, read-only rules, request
   size limit, API routing) and the `fuseki` and `e2e` tests;
3. runs `docker compose down` (without `-v`) and `up`, and checks that the
   graph is still there;
4. makes a backup, restores it, and checks that the graph is the same.

```bash
scripts/deployment_smoke_test.sh
```

It uses its own Compose project (`movielens-kg-smoke`), volume, ports
(2101–2104), and temporary folders, so your real graph is not touched. It
removes everything it created at the end. CI runs it on every push (see
`.github/workflows/ci.yml`).

The end-to-end tests run the real API code, validator, and Fuseki, with a fake
LLM, so they need no API key.

## Running the API on the host (without the API container)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d fuseki
# .env: FUSEKI_QUERY_ENDPOINT=http://127.0.0.1:2004/movielens/sparql plus the LLM_* settings
uv run uvicorn main:app --port 8000
# open http://127.0.0.1:8000/api/docs
```

## LLM provider examples

Any server with an OpenAI-compatible `/chat/completions` endpoint works.

| Provider | `LLM_BASE_URL` | Notes |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `LLM_RESPONSE_FORMAT=json_schema` |
| OpenRouter | `https://openrouter.ai/api/v1` | use `json_object` if the model has no structured outputs |
| Ollama (host) | `http://host.docker.internal:11434/v1` | `LLM_API_KEY` empty; `json_object` is the safer choice |

The key is read only on the server and never sent to the browser or written to
logs.

## Query time limit

`SPARQL_QUERY_TIMEOUT_SECONDS` (default 15) is used by both Fuseki and the API.
Change it in `.env` and restart both services:

```bash
docker compose up -d --force-recreate fuseki api
```

## Public domain and TLS

Target: `https://movielens-knowledge.graphs.web.id/` with `/sparql`.

Pick **one** place to terminate TLS:

- **Option A — Caddy does TLS.** Set `SITE_ADDRESS=movielens-knowledge.graphs.web.id`
  and `PROXY_BIND_ADDRESS=0.0.0.0`. Forward external ports 80/443 to host
  ports 2001/2002 (firewall/NAT). Caddy gets a Let's Encrypt certificate.
- **Option B — an existing host proxy does TLS.** Keep `SITE_ADDRESS=:80` and
  `PROXY_BIND_ADDRESS=127.0.0.1`. The host proxy terminates HTTPS and forwards
  plain HTTP to `127.0.0.1:2001`.

DNS only points the name to the server; it does not forward ports.

## Not included yet

- Rate limiting is not built into the stock Caddy image. Add it at the host
  proxy or with a Caddy rate-limit plugin before heavy public use.
- The web frontend is served via the `web` service in Docker Compose on port 80 (routed through Caddy proxy at port 2001). For local frontend development, use `cd frontend && npm run dev` (or `bun run dev`).
