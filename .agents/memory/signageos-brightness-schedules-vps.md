---
name: Brightness schedules VPS bug
description: Por que presets/agendamentos de brilho não funcionavam no VPS e como foi corrigido
---

## Raiz do problema

A tabela `brightness_schedules` existia no schema Drizzle (`lib/db/src/schema/screens.ts`) mas **nunca tinha uma migration `CREATE TABLE IF NOT EXISTS`** no arquivo `artifacts/api-server/src/index.ts`.

Consequência: no VPS, o heartbeat executava `db.select().from(brightnessSchedulesTable).where(...)` → PostgreSQL retornava "relation does not exist" → Express retornava 500 → player capturava o erro silenciosamente no `catch` → nenhum brilho era aplicado.

Também: ao tentar aplicar um preset via dashboard, `db.delete(brightnessSchedulesTable)` lançava o mesmo erro → endpoint de preset retornava 500 → os slots nunca eram inseridos.

## Fix aplicado

1. Adicionada migration `CREATE TABLE IF NOT EXISTS brightness_schedules (...)` em `artifacts/api-server/src/index.ts` (safe migrations).
2. Adicionado `try-catch` defensivo em torno do fetch de schedules no heartbeat (`artifacts/api-server/src/routes/player.ts`) — se a tabela falhar por qualquer motivo, o heartbeat continua sem schedules em vez de retornar 500.

**Why:** Safe migrations no runSafeMigrations() só tinham ALTER TABLE para colunas, mas nunca um CREATE TABLE para brightness_schedules. O padrão correto é: qualquer tabela criada DEPOIS do deploy inicial deve ter CREATE TABLE IF NOT EXISTS nas safe migrations.

**How to apply:** Sempre que adicionar uma nova tabela ao schema Drizzle, adicionar o CREATE TABLE IF NOT EXISTS correspondente em `artifacts/api-server/src/index.ts` dentro de `runSafeMigrations()`.
