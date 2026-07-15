#!/bin/bash
# ============================================================
# RPShow — Atualizar para nova versão (usar toda vez que mudar o código)
# Como usar: bash 3_atualizar.sh
# ============================================================
set -e

cd /var/www/rpshow

echo "=============================="
echo " RPShow — Atualizando..."
echo "=============================="

# Puxar código novo do GitHub
git pull origin main

# Instalar novas dependências (se houver)
pnpm install --frozen-lockfile

# Build da API
echo "Build da API..."
pnpm --filter @workspace/api-server run build

# Build do dashboard
echo "Build do dashboard..."
pnpm --filter @workspace/signage-dashboard run build

# Rodar migrações de banco (se houver novas tabelas)
echo "Migrando banco de dados..."
pnpm --filter @workspace/db run push

# Reiniciar a API
echo "Reiniciando API..."
pm2 restart rpshow-api

echo ""
echo "=============================="
echo " Atualização concluída!"
echo "=============================="
