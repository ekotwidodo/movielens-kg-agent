#!/bin/sh
# Offline maintenance for the TDB2 database.
#
# Fuseki MUST be stopped first (`docker compose stop fuseki`). TDB2 allows only
# one Java process to use a database directory at a time.
#
#   load    [file]  Replace the database with a Turtle file (default: <staging>/movielens.ttl)
#   backup          Write a gzipped N-Quads backup to /fuseki/backups
#   restore <file>  Replace the database with a backup file from /fuseki/backups
set -eu

DB_DIR="${TDB2_DATA_DIR}"
WORK_DIR="${DB_DIR}.loading"
STAGING_DIR="${FUSEKI_STAGING_DIR:-/fuseki/staging}"
BACKUP_DIR="${FUSEKI_BACKUP_DIR:-/fuseki/backups}"

run_java() {
  # shellcheck disable=SC2086
  java ${JAVA_OPTIONS} -cp "${FUSEKI_JAR}" "$@"
}

# Build the new database next to the old one and swap only after a successful
# load, so a failed load never leaves a half-filled database behind.
replace_database_from() {
  source_file="$1"
  if [ ! -f "${source_file}" ]; then
    echo "error: file not found: ${source_file}" >&2
    exit 1
  fi
  rm -rf "${WORK_DIR}"
  echo "Loading ${source_file} into a new TDB2 database..."
  run_java tdb2.tdbloader --loc "${WORK_DIR}" "${source_file}"
  echo "Generating ARQ query optimization statistics (stats.opt)..."
  run_java tdb2.tdbstats --loc "${WORK_DIR}" > "${WORK_DIR}/Data-0001/stats.opt" 2>/dev/null || true
  cp "${WORK_DIR}/Data-0001/stats.opt" "${WORK_DIR}/stats.opt" 2>/dev/null || true
  rm -rf "${DB_DIR}"
  mv "${WORK_DIR}" "${DB_DIR}"
  echo "Done. Start Fuseki again: docker compose start fuseki"
}

command="${1:-}"
case "${command}" in
  load)
    replace_database_from "${2:-${STAGING_DIR}/movielens.ttl}"
    ;;
  backup)
    if [ ! -d "${DB_DIR}" ]; then
      echo "error: no database at ${DB_DIR}" >&2
      exit 1
    fi
    # tdbbackup writes into <db>/Backups/. Move the files out, because a later
    # `load` replaces the whole database directory.
    run_java tdb2.tdbbackup --loc "${DB_DIR}"
    mv "${DB_DIR}"/Backups/*.nq.gz "${BACKUP_DIR}/"
    ls -l "${BACKUP_DIR}"
    ;;
  restore)
    replace_database_from "${BACKUP_DIR}/${2:?usage: restore <backup-file-name>}"
    ;;
  *)
    echo "usage: kg-admin.sh load [file] | backup | restore <backup-file-name>" >&2
    exit 2
    ;;
esac
