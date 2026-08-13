---
name: Overlay toggle per-screen
description: Toggle de relógio e status de rede por tela via heartbeat (Task #19)
---

## Implementação

**DB schema** (`lib/db/src/schema/screens.ts`):
- `showOverlay: boolean("show_overlay").notNull().default(true)` adicionado ao screensTable

**Migration** (`artifacts/api-server/src/index.ts`):
- `ALTER TABLE screens ADD COLUMN IF NOT EXISTS show_overlay BOOLEAN NOT NULL DEFAULT true`

**Heartbeat** (`artifacts/api-server/src/routes/player.ts`):
- Select inclui `showOverlay: screensTable.showOverlay`
- Envia `showOverlay: false` no JSON apenas quando `screen.showOverlay === false` (minimiza upgrade 204→200)
- Condição de resposta 200 inclui `|| overlayOff`

**Dashboard** (`artifacts/signage-dashboard/src/pages/screen-detail.tsx`):
- State: `overlayEnabled` (boolean, inicializado do screen data via useEffect)
- Handler: `handleToggleOverlay` faz `updateScreen.mutateAsync` com `{ showOverlay: checked }`
- UI: Card com Switch após o card de Fuso Horário
- Import: `Switch` de `@/components/ui/switch` adicionado

**Player** (`artifacts/player-app/app/player/[code].tsx`):
- `HBResp` type inclui `showOverlay?: boolean`
- Após receber heartbeat: `if (typeof data.showOverlay === "boolean") { setShowClock(data.showOverlay); AsyncStorage.setItem(...) }`
- O `showClock` existente controla o `DeviceClockOverlay` (renderização condicional já existia)

**Why:** O overlay (DeviceClockOverlay) já era controlado por `showClock` localmente via painel de controle do player. Estender para controle remoto foi natural — o heartbeat já era o canal de comandos para brightness/APK/token.

**How to apply:** Para novos comandos via heartbeat: (1) adicionar campo ao DB, (2) selecionar no heartbeat, (3) incluir na resposta 200 quando diferente do default, (4) adicionar à condição de upgrade 204→200, (5) ler no player após `if (data) { ... }`.

## Observação sobre APK

O player precisava de um novo APK (v1.15.56/185) para responder ao campo `showOverlay`. O toggle no dashboard salva o valor no DB imediatamente, mas o player só obedece após instalar o APK com o código atualizado.
