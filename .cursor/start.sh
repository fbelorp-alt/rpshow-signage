#!/usr/bin/env bash
# Per-boot startup for the RPSHOW dev environment.
# Brings up PostgreSQL + schema, then launches the api-server and dashboard
# dev servers in the background. Every step is idempotent and returns promptly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DB_USER="rpshow"
DB_PASS="rpshow"
DB_NAME="rpshow"
API_PORT="${API_PORT:-5000}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

# 1) Start the local PostgreSQL 16 cluster if it is not already accepting
#    connections. pg_ctlcluster errors if already running, so guard it.
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

# 3) Sync the Drizzle schema (idempotent — drizzle-kit push reconciles).
pnpm --filter @workspace/db run push

# 4) Launch dev servers in the background if they are not already listening.
#    Logs are written to /tmp so they can be tailed by the agent/developer.
if ! curl -sf "http://127.0.0.1:${API_PORT}/api/healthz" >/dev/null 2>&1; then
  DATABASE_URL="$DATABASE_URL" PORT="$API_PORT" NODE_ENV=development \
    nohup pnpm --filter @workspace/api-server run dev \
    >/tmp/rpshow-api-server.log 2>&1 &
  echo "start.sh: api-server starting on :${API_PORT} (logs: /tmp/rpshow-api-server.log)"
fi

if ! curl -sf "http://127.0.0.1:${DASHBOARD_PORT}/" >/dev/null 2>&1; then
  PORT="$DASHBOARD_PORT" NODE_ENV=development \
    API_PROXY_TARGET="http://localhost:${API_PORT}" \
    nohup pnpm --filter @workspace/signage-dashboard run dev \
    >/tmp/rpshow-dashboard.log 2>&1 &
  echo "start.sh: dashboard starting on :${DASHBOARD_PORT} (logs: /tmp/rpshow-dashboard.log)"
fi

echo "start.sh: PostgreSQL ready on 127.0.0.1:5432 (db '${DB_NAME}'), schema synced."
