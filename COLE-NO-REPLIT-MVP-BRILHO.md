# SPIKE — Brilho LED via API Local NovaStar (T50/TB50)

## Contexto
A API HTTP local NovaStar roda no próprio Taurus na porta **7788**.
Como o APK RPSHOW também roda NO Taurus, o endereço de acesso pode ser `localhost:7788`.

## Resultado do spike
> Preencher após o teste no T50:
> - [ ] `localhost:7788` responde (APK → API local)
> - [ ] Login retorna token
> - [ ] `PUT /brightness` muda o LED de verdade
> - [ ] Qual o IP/host que funcionou: ___________
> - [ ] Versão de firmware do T50: ___________

---

## Código do spike — colar no player `[code].tsx`

Adicionar **temporariamente** um botão de teste na tela do player.
Remover após confirmar que funciona.

```typescript
// ── SPIKE brilho NovaStar ─────────────────────────────────────────────────
// Testar em: localhost, 127.0.0.1, 192.168.x.x (IP do dispositivo na rede)
const NOVASTAR_HOSTS = ["localhost", "127.0.0.1"];
const NOVASTAR_PORT = 7788;
const NOVASTAR_USER = "admin";
const NOVASTAR_PASS = "123456"; // padrão de fábrica

async function novastarSetBrightness(brightness: number): Promise<string> {
  for (const host of NOVASTAR_HOSTS) {
    try {
      const base = `http://${host}:${NOVASTAR_PORT}`;

      // 1. Login
      const loginRes = await fetch(`${base}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: NOVASTAR_USER, password: NOVASTAR_PASS }),
      });
      if (!loginRes.ok) continue;
      const loginData = await loginRes.json();
      const token = loginData?.token ?? loginData?.data?.token;
      if (!token) continue;

      // 2. Set brightness
      const brightnessRes = await fetch(`${base}/api/v1/brightness`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ brightness }),
      });
      const result = await brightnessRes.json();
      return `${host}:${NOVASTAR_PORT} → ${JSON.stringify(result)}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`novastar ${host} falhou:`, msg);
    }
  }
  return "FALHOU em todos os hosts";
}
```

**Botão de teste** (adicionar temporariamente na JSX do player):
```tsx
{__DEV__ && (
  <Pressable
    style={{ position: "absolute", top: 10, right: 10, backgroundColor: "#ff0", padding: 8, zIndex: 9999 }}
    onPress={async () => {
      const r = await novastarSetBrightness(50);
      console.log("SPIKE BRILHO:", r);
      alert(r);
    }}
  >
    <Text>SPIKE 50%</Text>
  </Pressable>
)}
```

---

## O que anotar após o teste

1. **Qual host funcionou** (`localhost` / `127.0.0.1` / IP externo)
2. **Resposta do login** — estrutura exata do JSON (o campo `token` pode estar aninhado)
3. **Resposta do brightness** — `{ errCode: 0, errMsg: "Success" }` = funcionou
4. **O LED mudou visualmente?** (isso é o critério final)
5. **Senha padrão mudou?** (alguns Taurus vêm com senha customizada)

---

## Se `localhost` não funcionar

Tentar o IP local do dispositivo. No T50 via Wi-Fi AP:
- IP padrão do AP: `192.168.43.1`
- Conectar celular/notebook no Wi-Fi do T50 → testar `http://192.168.43.1:7788/api/v1/login`

Se o APK não alcança `localhost:7788`, significa que o processo NovaStar não escuta no loopback
— nesse caso o APK precisará do IP LAN do dispositivo (enviado via heartbeat ou fixo por config).
