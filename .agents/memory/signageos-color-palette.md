---
name: Paleta teal/mint dashboard
description: Primary color migrado de vermelho para teal #79B4B0; regras sobre o que fica vermelho
---

# Paleta de cores do dashboard

## Regra principal
`--primary` foi migrado de vermelho (`hsl 4 80% 48%`) para teal `#79B4B0` (`hsl 176 28% 59%`).
Dark mode usa `hsl(176 32% 63%)` (ligeiramente mais claro para contraste no fundo escuro).

## Variáveis alteradas em index.css
- `--primary` → `176 28% 59%` (light) / `176 32% 63%` (dark)
- `--ring` → `176 28% 59%` (light) / `176 32% 63%` (dark)
- `--sidebar-primary` → mesmo teal
- `--sidebar-ring` → mesmo teal
- `--destructive` → mantido vermelho `350 80% 50%` (semântico)

## O que FICA vermelho (semântico — não alterar)
- `--destructive` e variantes → botões Deletar/Remover, toast de erro
- `layout.tsx` Emergency Alert → `bg-red-500` animate-pulse (alerta crítico UX)
- Badges financeiras: Vencido, Suspenso → `bg-red-500/15 text-red-600`
- Badge Rejeitado (dispositivos), Bloqueado (usuários) → vermelho semântico
- Ícones YouTube (`text-red-500`) → cor da marca YouTube
- Séries de gráfico "Offline" (`#ef4444`) → status visual de tela offline
- Mensagens de erro de formulário (`text-red-400 bg-red-500/10`) → feedback de validação
- `security.tsx` botão "Desativar 2FA" (`bg-red-600`) → ação destrutiva
- `login.tsx` → página inteira mantida intacta (não tocar)

**Why:** O usuário pediu substituição de todo vermelho primário/brand por verde suave. Vermelho semântico (erros, alertas, destrutivo, status crítico) deve permanecer para comunicar urgência/perigo.

**How to apply:** Novos elementos de UI primários usam `bg-primary`/`text-primary` (herda teal via CSS var). Só usar `red-*` explícito para: erros de formulário, ações destrutivas, status crítico de sistema, brands (YouTube).
