# MVP — Controle de Brilho LED via RPSHOW

## Objetivo
O operador controla o brilho do painel LED direto no painel RPSHOW,
sem precisar abrir o ViPlex. O APK no Taurus executa o comando na API local NovaStar.

---

## Arquitetura

```
Operador (slider/agenda no dashboard)
    ↓ POST /api/screens/:id/brightness
API Server (salva targetBrightness no DB)
    ↓ heartbeat response { brightness: N }
APK no Taurus (~10s delay)
    ↓ PUT http://localhost:7788/api/v1/brightness
API local NovaStar (porta 7788)
    ↓ comando RS232/protocolo interno
Controlador LED → painel muda
```

**Status atual de cada camada:**

| Camada | Status |
|---|---|
| Dashboard slider + página `/brightness` | ✅ Implementado |
| `POST /api/screens/:id/brightness` | ✅ Implementado |
| Heartbeat entrega `{ brightness: N }` | ✅ Implementado |
| APK chama API local NovaStar | ⏳ Aguarda resultado do spike |
| Agenda dia/noite (cron no servidor) | 🔲 Próxima fase |

---

## Fase 1 — Spike (T50, fazer primeiro)

**Critério de go/no-go:** o LED físico muda de brilho quando o APK chama `localhost:7788`.

Ver `COLE-NO-REPLIT-MVP-BRILHO.md` para o código de teste.

**Se go:** implementar `novastarSetBrightness()` no player e ligar ao heartbeat.
**Se no-go em localhost:** tentar IP LAN; se necessário, o DB armazena o IP do device
(heartbeat já envia `resolution`, pode enviar `localIp` também).

---

## Fase 2 — Implementação (após spike confirmado)

### 2.1 Player `[code].tsx`
Substituir o `expo-brightness` pela chamada NovaStar:

```typescript
async function applyLedBrightness(brightness: number, localIp?: string) {
  const hosts = localIp ? [localIp, "localhost"] : ["localhost", "127.0.0.1"];
  for (const host of hosts) {
    try {
      const base = `http://${host}:7788`;
      const { token } = await fetch(`${base}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: "admin", password: "123456" }),
      }).then(r => r.json());

      const res = await fetch(`${base}/api/v1/brightness`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brightness }),
      }).then(r => r.json());

      if (res.errCode === 0) return true; // sucesso
    } catch { continue; }
  }
  return false; // falhou em todos
}
```

No heartbeat: `if (data.brightness !== undefined) await applyLedBrightness(data.brightness);`

### 2.2 DB — armazenar senha personalizada (opcional)
Se o cliente mudou a senha padrão `123456`:
- Adicionar `novastarPassword text` na tabela `screens`
- Tela de configuração no screen-detail (campo "Senha NovaStar")
- Heartbeat envia a senha junto com o `brightness`

### 2.3 Agenda dia/noite (Fase 2B)
Cron job no servidor (ou regra no player):

```
[{ time: "05:00", brightness: 80 },
 { time: "18:00", brightness: 40 },
 { time: "22:00", brightness: 20 }]
```

Armazenar como `brightnessScheduleJson` na tela.
UI: igual à agenda de liga/desliga (campos de hora + valor).
Player avalia localmente (funciona offline).

---

## Fase 3 — Outros modelos (após T50 validado)

| Modelo | Firmware base | Porta padrão | Diferença esperada |
|---|---|---|---|
| T50 / TB50 | Taurus | 7788 | Referência |
| T10 Plus | Taurus lite | 7788 | Possível resposta JSON diferente |
| TB60 | Taurus Pro | 7788 | Verificar campo `token` no login |

Estratégia: mesmo código, testar resposta do login por modelo e adaptar o parser do token.

---

## O que o ViPlex continua fazendo

- Mapeamento inicial do painel (cabinet layout, resolução, calibração)
- Upgrade de firmware
- Configuração de rede avançada
- Diagnóstico de hardware

**Brilho operacional do dia a dia → RPSHOW substitui o ViPlex.**

---

## Métricas de sucesso do MVP

- [ ] Slider 0–100% no dashboard muda o LED em ≤ 15s (tempo de heartbeat)
- [ ] Agenda 05:00/18:00 funciona sem o operador abrir o dashboard
- [ ] Funciona quando o APK está na mesma rede que o painel (LAN local)
- [ ] Sem crash no APK se a API NovaStar não responder (try/catch)
