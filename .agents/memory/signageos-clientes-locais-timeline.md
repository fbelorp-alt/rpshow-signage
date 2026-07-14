---
name: Clientes, Locais e Connection Timeline
description: Três features Inviron-inspired implementadas em paralelo — entidade Cliente completa, Locais com mapa OSM, e timeline de conexões no monitoring.
---

## Clientes/Anunciantes
- `clients` table: added `cnpj` (text), `segment` (text), `userId` (text)
- `/api/clients` rebuilt without api-zod types — uses auth guard, `(req.user as any).id`, filters by userId
- Dashboard `/clientes`: tabela com busca/filtro por segmento, CNPJ auto-formatado (XX.XXX.XXX/XXXX-XX), badge de status ativo/inativo, modal criar/editar, delete confirm
- Sidebar operador: item com Building2 icon

**Why:** Clientes precisavam de CNPJ e segmento para emissão de comprovantes e relatórios segmentados.

## Locais
- New `locations` table: id, userId, name, abbreviation, address, city, latitude, longitude, imageUrl, audience, audienceUnit, timezone, internalId, productionType, description, createdAt
- `/api/locations` — CRUD com userId filtering (admin vê todos)
- Dashboard `/locais`: geocoding via Nominatim (OpenStreetMap, sem API key); preview do mapa via iframe OSM embed (bbox centrado no ponto)
- Sidebar operador: item com MapPin icon

**How to apply:** Para geocodear: `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`; mapa embed: `https://www.openstreetmap.org/export/embed.html?bbox=...&marker=lat,lon`

## Connection Timeline
- New `screen_connections` table: id, screenId (FK→screens cascade), connectedAt, disconnectedAt
- Player heartbeat: quando `screen.status !== "online"` (wasOffline), fecha open connections e insere nova row com `connectedAt = now()`
- `GET /api/monitoring/:id/connections`: busca últimos 7 dias, auto-fecha connections abertas se lastSeen > 5 min atrás
- Frontend monitoring: 4º tab "Conexões" com barra horizontal por dia (verde=online, vermelho=offline, % uptime), lista de eventos

**Why:** Permite auditoria de uptime por período sem depender apenas de lastSeen snapshot.
