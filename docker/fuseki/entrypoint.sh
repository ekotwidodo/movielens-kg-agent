#!/bin/sh
# Start Fuseki "main": SPARQL query endpoint only, no admin API, no web UI.
set -eu

CONFIG_TEMPLATE="${FUSEKI_CONFIG_TEMPLATE:-/fuseki/config.ttl.template}"
RUNTIME_CONFIG="${FUSEKI_RUNTIME_CONFIG:-/fuseki/run/config.ttl}"
TIMEOUT_SECONDS="${SPARQL_QUERY_TIMEOUT_SECONDS:-15}"

# The same SPARQL_QUERY_TIMEOUT_SECONDS is read by the API, so both sides use one value.
case "${TIMEOUT_SECONDS}" in
  ''|*[!0-9.]*|*.*.*|.)
    echo "error: SPARQL_QUERY_TIMEOUT_SECONDS must be a positive number, got '${TIMEOUT_SECONDS}'" >&2
    exit 2
    ;;
esac
TIMEOUT_MS=$(awk -v seconds="${TIMEOUT_SECONDS}" 'BEGIN { printf "%d", seconds * 1000 }')
if [ "${TIMEOUT_MS}" -le 0 ]; then
  echo "error: SPARQL_QUERY_TIMEOUT_SECONDS must be greater than 0" >&2
  exit 2
fi

mkdir -p "$(dirname "${RUNTIME_CONFIG}")"
sed -e "s|@QUERY_TIMEOUT_MS@|${TIMEOUT_MS}|" \
    -e "s|@TDB2_DATA_DIR@|${TDB2_DATA_DIR}|" \
    "${CONFIG_TEMPLATE}" > "${RUNTIME_CONFIG}"
echo "Fuseki query timeout: ${TIMEOUT_MS} ms"

if [ ! -d "${TDB2_DATA_DIR}/Data-0001" ]; then
  echo "WARNING: no TDB2 database found at ${TDB2_DATA_DIR}." >&2
  echo "         Load the graph first: docker compose run --rm kg-loader load" >&2
fi

# shellcheck disable=SC2086  # JAVA_OPTIONS holds several JVM flags on purpose.
exec java ${JAVA_OPTIONS} -cp "${FUSEKI_JAR}" \
  org.apache.jena.fuseki.main.cmds.FusekiMainCmd \
  --port="${FUSEKI_PORT:-3030}" --config="${RUNTIME_CONFIG}" "$@"
