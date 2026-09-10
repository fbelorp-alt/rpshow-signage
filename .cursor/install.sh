#!/usr/bin/env bash
# Idempotent dependency install for the RPSHOW pnpm workspace.
# Runs after the repository is checked out. Safe to run repeatedly.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Install all workspace dependencies exactly as pinned by the lockfile.
# Generated API client/zod files are committed, so no codegen is required here.
pnpm install --frozen-lockfile

echo "install.sh: workspace dependencies installed."
