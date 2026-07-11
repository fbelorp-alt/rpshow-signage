---
name: CobrancaModal unificado
description: PaymentModal e PlanModal foram fundidos em CobrancaModal em financeiro-admin.tsx
---

## Regra
`CobrancaModal` é o único componente de cobrança — não existem mais `PaymentModal` nem `PlanModal`.

## Estrutura
- `CobrancaMode = "single" | "plan"` — toggle no topo do modal
- `CCharge` — tipo por tela: `{ screenId, name, include, price, dueDate, status, blockIfUnpaid }`
- Helpers de módulo (fora do componente): `defDueDate()`, `addMonthsStr(dateStr, n)`, `refMonFromDate(dateStr)`, `PAY_TYPES`
- `Invoice.screenId: number | null` — adicionado; alimentado por `p.screenId ?? null` no transform `allInvoices`

## Modo Avulsa
- Vencimento + status editável por tela individualmente
- Sem telas: campo de valor manual + data + status

## Modo Plano
- Seletor 1-12 meses (grid de botões)
- Campo "1º Vencimento" → datas seguintes calculadas via `addMonthsStr`
- Prévia de slots: tabela com vencimento e total/mês
- Sem telas: valor manual

## Bloqueio por tela
- Botão toggle "Bloquear?" por linha → `blockIfUnpaid: boolean`
- No submit: chama `PATCH /api/admin/screens/:id/block { blocked: true }` quando `blockIfUnpaid && status !== "paid"`

**Why:** Usuário queria preços editáveis por tela + fluxo de plano + bloqueio num único modal em vez de dois separados.
