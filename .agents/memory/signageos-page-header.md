---
name: PageHeader component
description: Componente de cabeçalho de página compartilhado — design elegante com barra vertical + ícone estilizado
---

# PageHeader — design pattern para cabeçalhos de páginas

**Localização:** `artifacts/signage-dashboard/src/components/page-header.tsx`

**Props:** `icon: LucideIcon`, `title: string`, `description?: string`, `actions?: ReactNode`, `className?: string`

**Visual:** barra vertical `w-[3px] h-10 bg-primary rounded-full` + ícone em `w-9 h-9 rounded-xl bg-primary/10` + título `text-[18px] font-semibold`

**Aplicado em:** admin.tsx (Dashboard), screens.tsx (Telas), playlists.tsx (Playlists), monitoring.tsx (Monitoramento)

**Why:** Usuário pediu "suave e elegante" — não garish/colorido. Detalhe sutil mas consistente em cada cabeçalho.

**How to apply:** Quando criar uma nova página, importar PageHeader e substituir o div+h1 padrão. O `actions` recebe os botões de ação da direita.

## Admin dashboard cards — design elegante
Os stat cards do admin.tsx usam `border-l-4` colorido em vez de `bg-gradient-to-br`. 
Pattern: `bg-card border border-l-4 border-l-{color} rounded-xl p-4 hover:shadow-sm`
Com ícone em `bg-{color}-50 rounded-lg` e número em `text-foreground` (não colorido).
