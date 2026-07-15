# RPShow — Deploy no Hostinger VPS

## O que você vai precisar

- VPS Hostinger com **Ubuntu 22.04 ou 24.04**
- Mínimo: **2 vCPU, 4GB RAM** (KVM1 ou KVM2 da Hostinger)
- Domínio `app.rpshow.com.br` apontando para o IP do VPS

---

## PASSO 1 — Apontar o domínio para o VPS

No painel da Hostinger (ou onde o domínio rpshow.com.br está gerenciado):

1. Vá em **DNS / Zona DNS**
2. Adicione um registro **A**:
   - Nome: `app`
   - Valor: `IP DO SEU VPS` (ex: 123.456.789.0)
   - TTL: 300

> Aguarde 5-30 minutos para o DNS propagar.

---

## PASSO 2 — Acessar o VPS via SSH

No Windows, abra o **PowerShell** ou **PuTTY**:

```bash
ssh root@IP_DO_SEU_VPS
```

---

## PASSO 3 — Importar o banco de dados

Faça upload do arquivo `rpshow_backup.sql` para o VPS:

```bash
# No seu computador (PowerShell):
scp rpshow_backup.sql root@IP_DO_VPS:/root/
```

No VPS, importe:
```bash
sudo -u postgres psql rpshowdb < /root/rpshow_backup.sql
```

---

## PASSO 4 — Rodar o setup inicial

```bash
# Baixar os scripts do GitHub
cd /root
git clone https://github.com/fbelorp-alt/rpshow-signage.git scripts_temp
cd scripts_temp/deploy

# Rodar setup (demora ~5 minutos)
bash 1_setup_servidor.sh
```

---

## PASSO 5 — Editar as variáveis de ambiente

```bash
nano /var/www/rpshow/artifacts/api-server/.env
```

Preencha os valores (tecle CTRL+X, Y, Enter para salvar):

```
DATABASE_URL=postgresql://rpshow:SUA_SENHA@localhost:5432/rpshowdb
SESSION_SECRET=qualquer_texto_longo_aqui_ex_abc123xyz456
```

---

## PASSO 6 — Configurar nginx e SSL

```bash
bash /root/scripts_temp/deploy/2_nginx.sh app.rpshow.com.br
```

---

## PASSO 7 — Testar

Acesse `https://app.rpshow.com.br` no navegador. O painel deve aparecer!

---

## Como atualizar depois (quando eu mudar o código aqui)

```bash
ssh root@IP_DO_VPS
bash /var/www/rpshow/deploy/3_atualizar.sh
```

---

## Problemas comuns

**API não responde:**
```bash
pm2 logs rpshow-api
pm2 restart rpshow-api
```

**Ver status dos serviços:**
```bash
pm2 status
systemctl status nginx
systemctl status postgresql
```

**Reiniciar tudo:**
```bash
pm2 restart all
systemctl restart nginx
```
