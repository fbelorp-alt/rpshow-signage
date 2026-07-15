#!/bin/bash
# ============================================================
# RPShow — Setup inicial do servidor Ubuntu (rodar UMA VEZ)
# Como usar: bash 1_setup_servidor.sh
# ============================================================
set -e
export DEBIAN_FRONTEND=noninteractive

echo "=============================="
echo " RPShow — Setup do servidor"
echo "=============================="

# 1. Atualizar sistema
apt update && apt upgrade -y -o Dpkg::Options::="--force-confkeep"

# 2. Instalar dependências básicas
apt install -y curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib ufw

# 3. Instalar Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs

# 4. Instalar pnpm
npm install -g pnpm@9

# 5. Instalar PM2 (mantém a API rodando)
npm install -g pm2

# 6. Configurar PostgreSQL
echo "Configurando banco de dados..."
sudo -u postgres psql -c "CREATE USER rpshow WITH PASSWORD 'TROQUE_ESTA_SENHA';"
sudo -u postgres psql -c "CREATE DATABASE rpshowdb OWNER rpshow;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rpshowdb TO rpshow;"

# 7. Clonar repositório
echo "Clonando repositório..."
mkdir -p /var/www
cd /var/www
git clone https://github.com/fbelorp-alt/rpshow-signage.git rpshow
cd rpshow

# 8. Criar arquivo .env (PREENCHER depois)
cat > artifacts/api-server/.env << 'ENVEOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://rpshow:TROQUE_ESTA_SENHA@localhost:5432/rpshowdb
SESSION_SECRET=GERE_UMA_CHAVE_ALEATORIA_LONGA_AQUI
DEFAULT_OBJECT_STORAGE_BUCKET_ID=local
PRIVATE_OBJECT_DIR=/var/www/rpshow/storage/private
PUBLIC_OBJECT_SEARCH_PATHS=/var/www/rpshow/storage/public
ENVEOF

# 9. Criar pastas de storage
mkdir -p /var/www/rpshow/storage/private
mkdir -p /var/www/rpshow/storage/public

# 10. Instalar dependências e fazer build
echo "Instalando dependências..."
pnpm install --no-frozen-lockfile

echo "Fazendo build da API..."
pnpm --filter @workspace/api-server run build

echo "Fazendo build do dashboard..."
pnpm --filter @workspace/signage-dashboard run build

# 11. Migrar banco de dados
echo "Migrando banco de dados..."
cd /var/www/rpshow
pnpm --filter @workspace/db run push

# 12. Configurar PM2
pm2 start /var/www/rpshow/artifacts/api-server/dist/index.js \
  --name rpshow-api \
  --env production \
  -i 1 \
  -- --max-old-space-size=512
pm2 save
pm2 startup

# 13. Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=============================="
echo " Setup concluído!"
echo " Próximo passo: rodar 2_nginx.sh"
echo "=============================="
