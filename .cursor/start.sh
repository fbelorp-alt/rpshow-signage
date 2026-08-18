#!/usr/bin/env bash
# Per-boot runtime reconciliation for the RPSHOW dev environment.
# Ensures PostgreSQL is running and the schema is in sync before the
# api-server and dashboard terminals start. Every step is idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_USER="rpshow"
DB_PASS="rpshow"
DB_NAME="rpshow"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

# 1) Start the local PostgreSQL 16 cluster if it is not already accepting
#    connections. pg_ctlcluster is a no-op error if already running, so guard it.
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  sudo pg_ctlcluster 16 main start || true
fi

# Wait (up to ~30s) for PostgreSQL to accept connections.
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then break; fi
  sleep 1
done

if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "start.sh: PostgreSQL did not become ready in time." >&2
  exit 1
fi

# 2) Ensure the dev role and database exist (idempotent).
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

# 3) Sync the Drizzle schema. drizzle-kit push reconciles the DB to the
#    schema defined in lib/db, so this is safe to run on every boot.
pnpm --filter @workspace/db run push

echo "start.sh: PostgreSQL ready on 127.0.0.1:5432 (db '${DB_NAME}'), schema synced."
