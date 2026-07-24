---
name: Player video URI bug history
description: Root causes and fixes for blank screen / looping bugs in the Expo player video rendering
---

# Player video URI — bug history

## Bug 1: blank screen (v34/v35 → fixed em v38)

**Sintoma:** Tela preta. VideoPlayer nunca renderiza. Sem timer de avanço. Player travado.

**Causa raiz (v34/v35):** `currentVideoUri` computada via mutação de ref DURANTE o render. No primeiro render (sem dados), ref = null para índice 0. No segundo render (dados chegaram), índice ainda 0 — reset pulado, fill também não ativado. VideoPlayer recebeu `null` → não renderizou → sem `onEnd` → sem avanço.

**Causa raiz (v37):** Usou `useState + useEffect`, mas derivação era `currentVideoUri = videoState`. Imediatamente após `advance()` (ex: índice 3→0), state ainda tinha a URI do índice antigo. VideoPlayer remontava (key mudou) mas recebia URI errada → vídeo errado repetia.

**Fix final (v38):** `videoState = {index, uri}` e `currentVideoUri = videoState.index === currentIndex ? videoState.uri : null`. Na transição, `videoState.index` ainda é o antigo → URI derivada é null → VideoPlayer não monta até o effect preencher o novo índice.

**Regra:** usar padrão `{index, uri}` para URI congelada por índice. Nunca mutar refs durante render. Nunca `useState<string|null>` simples para estado por índice.

---

## Bug 2: loop no último vídeo — 1ª passagem (v33/v37 → fix em v38)

**Sintoma:** Toca N vídeos em ordem, chega no último, loopa infinitamente sem voltar ao primeiro.

**Causa raiz:** Mesmo problema do Bug 1 — `currentVideoUri` state tinha URI antiga quando `currentIndex` voltava ao zero (wrap N→0). VideoPlayer remontava com `key=0` mas recebia conteúdo do vídeo N. Quando terminava, `advance()` era chamado com `currentIndex=0`, gerava `nxt=1` — não repetia índice N, mas conteúdo do vídeo N aparecia em loop porque a URI estava errada.

**Fix:** Mesmo padrão `{index, uri}` — URI é null na transição → VideoPlayer não monta com conteúdo errado.

---

## Bug 3: loop no último vídeo — 2ª passagem (v48 → fix em v49)

**Sintoma (v48):** 1ª passagem completa (todos os vídeos OK). 2ª passagem: 1º e 2º OK, no 3º (último) patina/loopa infinitamente.

**Causa raiz confirmada:** ExoPlayer toca arquivo de **cache local** (`file://`) na 2ª passagem (download completa após ~60s). Com arquivo local, ExoPlayer pode não emitir eventos `onPlaybackStatusUpdate` de fim confiáveis — termina o vídeo silenciosamente, reinicia do zero sem chamar `onEnd`, sem acionar o `advance()`.

**Fix v49 — WALL-CLOCK ABSOLUTO:**
- `currentVideoUri` retorna SEMPRE a URL de rede (`src=net`) — nunca usa o arquivo de cache como URI do player.
- `cacheReadyForCurrent` é só um flag booleano para o HUD — não muda a URI.
- Timer wall-clock absoluto armado assim que a duração do vídeo é conhecida: quando o tempo real passa, dispara `advance("wall-clock")` independentemente do que o ExoPlayer reportar.
- Mantém também: corte a 80% (`cut-80`), detecção de rewind (`rewind`), watchdog pai.

**Versão em produção:** 1.14.61 / versionCode 80 / build tb10 run `29076625401`

**Regra crítica:** NUNCA alimentar `currentVideoUri` com URI de cache local (`file://`). ExoPlayer com arquivo local não é confiável para emitir eventos de fim. Sempre usar URL de rede + fallback wall-clock.

**Como aplicar em futuras mudanças:**
1. `currentVideoUri` deve sempre derivar de `resolveMediaUrl()` retornando URL de rede.
2. Armar sempre um timer wall-clock como segurança além do `onPlaybackStatusUpdate`.
3. Verificar com `rg "videoCacheMap\[net\]" [code].tsx` que o cache não está sendo usado como URI.

---

## Bug 4: tela preta após ~10min / vídeo some e reaparece em minutos (TB10 Plus v167 → fix v168)

**Sintoma (v1.15.38 / versionCode 167):** Após instalar APK correto (armeabi-v7a), vídeo aparecia por ~10s, some, ~1-2 minutos depois reaparecia. Ciclo se repetia indefinidamente.

**Causa raiz:** STUCK-EARLY disparava **falso positivo** durante buffering.
- STUCK-EARLY: 10s grace → se `livePosRef < 200ms` → COLD remount.
- No TB10 Plus (armeabi-v7a, processador mais lento + rede lenta), o vídeo pode levar >10s para carregar.
- Durante buffering: `knownDurationMs = 0`, `pos = 0` → stuck-early entendia como "ExoPlayer travado" → COLD remount.
- Após 4 ciclos (~40s): `stuckCount >= 4` → `BackHandler.exitApp()`.
- Watchdog reiniciava o app em ~1-2 min → usuário via "aparece, some, uns minutos depois aparece de novo".

**Fix (v1.15.39 / versionCode 168):**
- Grace period: 10s → 15s
- Adicionada guarda: `if (knownDurationMsRef.current === 0) return;` — só dispara se ExoPlayer já confirmou duração (vídeo carregado, não buffering)
- Threshold "normal": 200ms → 500ms
- stuckCount exitApp: 4 → 6
- Adicionado `knownDurationMsRef` (ref mirror de `knownDurationMs` state) para leitura síncrona em intervals

**Regra:** STUCK-EARLY deve sempre checar `knownDurationMs > 0` antes de disparar. Sem duração conhecida = video ainda buffering = não interferir.
