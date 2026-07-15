#!/bin/bash
# ============================================================
# RPShow — Configurar nginx + SSL (rodar UMA VEZ após setup)
# Como usar: bash 2_nginx.sh app.rpshow.com.br
# ============================================================
set -e

DOMAIN=${1:-app.rpshow.com.br}

echo "Configurando nginx para: $DOMAIN"

# Criar config do nginx
cat > /etc/nginx/sites-available/rpshow << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Dashboard (arquivos estáticos do Vite)
    root /var/www/rpshow/artifacts/signage-dashboard/dist;
    index index.html;

    # API — proxy para Express na porta 5000
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 500M;
        proxy_read_timeout 300s;
    }

    # Storage público (imagens/vídeos servidos direto)
    location /storage/public/ {
        alias /var/www/rpshow/storage/public/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # SPA fallback — todas as rotas vão para index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINXEOF

# Ativar o site
ln -sf /etc/nginx/sites-available/rpshow /etc/nginx/sites-enabled/rpshow
rm -f /etc/nginx/sites-enabled/default

# Testar config
nginx -t

# Reiniciar nginx
systemctl restart nginx
systemctl enable nginx

echo ""
echo "Gerando certificado SSL gratuito (Let's Encrypt)..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@rpshow.com.br --redirect

echo ""
echo "=============================="
echo " nginx + SSL configurados!"
echo " Acesse: https://$DOMAIN"
echo "=============================="
