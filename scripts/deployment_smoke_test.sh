#!/usr/bin/env bash
# Starts the full Docker Compose stack with the small test fixture and checks:
#   1. routing and read-only rules through the proxy, the API, and Fuseki
#   2. the graph survives `docker compose down` + `up` (named volume)
#   3. backup and restore give the same graph
#
# It uses its own Compose project, volume, ports, and folders, so it never
# touches your real graph. Everything it creates is removed at the end.
#
# Usage: scripts/deployment_smoke_test.sh        (needs Docker and uv)
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT=movielens-kg-smoke
WORK_DIR="$(mktemp -d)"

export TDB2_VOLUME_NAME=movielens_kg_smoke_tdb2
export GRAPH_STAGING_DIR="${WORK_DIR}/processed"
export BACKUP_DIR="${WORK_DIR}/backups"
export API_ENV_FILE="${WORK_DIR}/api.env"
export PROXY_BIND_ADDRESS=127.0.0.1
export PROXY_HTTP_HOST_PORT=2101
export PROXY_HTTPS_HOST_PORT=2102
export API_DEBUG_HOST_PORT=2103
export FUSEKI_DEBUG_HOST_PORT=2104
export SITE_ADDRESS=:80
# A short limit keeps the time-limit test fast.
export SPARQL_QUERY_TIMEOUT_SECONDS=3

PROXY_URL="http://127.0.0.1:${PROXY_HTTP_HOST_PORT}"
API_URL="http://127.0.0.1:${API_DEBUG_HOST_PORT}"
FUSEKI_URL="http://127.0.0.1:${FUSEKI_DEBUG_HOST_PORT}/movielens/sparql"
COMPOSE=(docker compose -p "${PROJECT}" -f docker-compose.yml -f docker-compose.dev.yml)

step() { printf '\n==> %s\n' "$*"; }

cleanup() {
  step "Cleaning up"
  "${COMPOSE[@]}" --profile tools down -v --remove-orphans || true
  rm -rf "${WORK_DIR}" || true
}
trap cleanup EXIT

count_triples() {
  curl -fsS "${FUSEKI_URL}" -H 'Accept: text/csv' \
    --data-urlencode 'query=SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }' | tail -n 1 | tr -d '\r'
}

expect_same_count() {
  local label="$1" expected="$2" actual
  actual="$(count_triples)"
  if [ "${actual}" != "${expected}" ]; then
    echo "FAILED: ${label}: expected ${expected} triples, found ${actual}" >&2
    exit 1
  fi
  echo "OK: ${label}: ${actual} triples"
}

step "Preparing work folder ${WORK_DIR}"
mkdir -p "${GRAPH_STAGING_DIR}" "${BACKUP_DIR}"
# The containers run as UID 1000, which may differ from the current user.
chmod 755 "${WORK_DIR}" "${GRAPH_STAGING_DIR}"
chmod 777 "${BACKUP_DIR}"
# The smoke test never calls the LLM, but the API needs these settings to start.
cat > "${API_ENV_FILE}" <<'EOF'
LLM_MODEL=smoke-test
LLM_BASE_URL=http://llm.invalid/v1
EOF

step "Building the fixture graph"
uv run mlkg-build-graph --source tests/fixtures/movielens \
  --output "${GRAPH_STAGING_DIR}/movielens.ttl" --report "${WORK_DIR}/import-report.json"
chmod 644 "${GRAPH_STAGING_DIR}/movielens.ttl"

step "Building images"
"${COMPOSE[@]}" --profile tools build

step "Loading the graph into TDB2"
"${COMPOSE[@]}" run --rm kg-loader load

step "Starting the stack"
"${COMPOSE[@]}" up -d --wait

step "API readiness"
curl -fsS "${API_URL}/health/ready"
echo

step "Running API test verification"
SMOKE_BASE_URL="${PROXY_URL}" \
FUSEKI_TEST_QUERY_ENDPOINT="${FUSEKI_URL}" \
  uv run pytest tests/test_api.py -ra

TRIPLES="$(count_triples)"
echo "Loaded graph: ${TRIPLES} triples"

step "Persistence: docker compose down (without -v), then up"
"${COMPOSE[@]}" down
"${COMPOSE[@]}" up -d --wait
expect_same_count "after down/up" "${TRIPLES}"

step "Backup and restore"
"${COMPOSE[@]}" stop fuseki
"${COMPOSE[@]}" run --rm kg-loader backup
BACKUP_FILE="$(find "${BACKUP_DIR}" -maxdepth 1 -name '*.nq.gz' -exec basename {} \; | head -n 1)"
if [ -z "${BACKUP_FILE}" ]; then
  echo "FAILED: no backup file was written" >&2
  exit 1
fi
echo "Backup file: ${BACKUP_FILE}"
"${COMPOSE[@]}" run --rm kg-loader restore "${BACKUP_FILE}"
"${COMPOSE[@]}" up -d --wait fuseki
expect_same_count "after restore" "${TRIPLES}"

step "All deployment smoke checks passed"
