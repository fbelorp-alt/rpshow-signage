# Brasil Tour & Business

Site institucional de página única (one-page) para a **Brasil Tour & Business**,
empresa brasileira de turismo, assessoria internacional e desenvolvimento de
negócios.

Stack: **Vite + React + TypeScript + Tailwind CSS**, com um globo 3D
fotorrealista em **three.js / @react-three/fiber / @react-three/drei** e
animações de entrada em **Framer Motion**. Site estático, sem CMS e sem
backend — pronto para publicar na Vercel, Netlify ou qualquer hospedagem
estática (`npm run build` gera a pasta `dist/`).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build   # gera ./dist — para publicar na Vercel/hospedagem estática
npm run preview # serve o build localmente para conferência
```

## Arquivo único para abrir com duplo clique (sem servidor)

Além do build normal, existe um build alternativo que gera **um único
arquivo HTML** — com JS, CSS e as texturas do globo (em 2K) todos embutidos
— para abrir direto no navegador com duplo clique, sem precisar rodar
`npm install`/`npm run dev` nem subir servidor nenhum:

```bash
npm run build:standalone   # gera dist-standalone/index.html
```

Uma cópia já gerada está em `entrega/brasil-tour-business.html`. Basta
baixar esse arquivo e dar duplo clique — ele abre como uma página normal.

> Por que isso é necessário: um site Vite comum usa "ES modules"
> (`<script type="module">`), que os navegadores recusam carregar quando a
> página é aberta via `file://` (protocolo usado ao dar duplo clique num
> arquivo local), por política de segurança do próprio navegador. O build
> `standalone` empacota tudo num único `<script>` clássico (sem módulos) e
> embute as texturas como `data:` URI, contornando essa restrição. Use-o
> apenas para conferência rápida — o build normal (`npm run build`) é o
> indicado para publicar de verdade, pois carrega o site bem mais rápido
> (código dividido em pedaços menores, texturas em 8K sob demanda).

## Estrutura

```
src/
  components/
    Nav.tsx            Cabeçalho fixo com o logotipo e o menu
    Hero.tsx            Seção de abertura (texto + globo 3D)
    Globe.tsx            Orquestra o Canvas do globo, carregamento e o painel de destino
    globe/               Peças internas do globo (Terra, nuvens, atmosfera, estrelas,
                          marcadores, controle de rotação/arraste)
    DestinationPanel.tsx Painel lateral aberto ao clicar num marcador
    About.tsx            "O que somos" + "Quem somos"
    Services.tsx         "O que fazemos" (lista dos 5 serviços)
    Experiences.tsx      "Experiências exclusivas" (Parintins e Rio de Janeiro)
    Differentials.tsx    Quatro diferenciais com ícones lucide-react
    Contact.tsx          WhatsApp, e-mail e Instagram
    Footer.tsx           Rodapé
    MediaPlaceholder.tsx Bloco "mídia pendente" usado onde falta foto/vídeo do cliente
  data/destinations.ts   Mercados, cidades e serviços exibidos no painel do globo
  lib/constants.ts       Dados de contato (WhatsApp, e-mail, Instagram, CNPJ)
  styles/globals.css     Variáveis de cor, tipografia e utilitários globais
public/
  textures/              Texturas da Terra (ver abaixo)
  media/                 Pasta reservada para fotos/vídeos do cliente
```

## O globo 3D

- Esfera `SphereGeometry(1, 128, 128)` com `MeshPhongMaterial` (mapa de cor +
  relevo + máscara de especular), camada de nuvens semitransparente e halo
  atmosférico via shader Fresnel customizado (`side: BackSide`,
  `blending: AdditiveBlending`).
- Texturas equiretangulares 2:1, com `colorSpace = SRGBColorSpace` nos mapas
  de cor e anisotropia máxima aplicada para nitidez em ângulo raso.
- Rotação automática lenta, pausada durante o arraste (mouse/toque); a
  inclinação vertical é travada entre −0.8 e +0.8 rad para nunca revelar o
  achatamento dos polos.
- Sete marcadores (lat/lon reais) renderizados como `<button>` HTML
  sobrepostos ao canvas (via `Html` do drei, com portal fora da `div`
  `aria-hidden` que envolve o canvas) — acessíveis por teclado e leitores de
  tela. Ao clicar, o globo gira suavemente até centralizar o país e abre um
  painel lateral com cidades atendidas e serviços disponíveis. Fecha com
  `Esc`, clique fora ou pelo botão de fechar.
- Respeita `prefers-reduced-motion` (sem rotação automática) e usa texturas
  2K + nuvens com menor opacidade em telas abaixo de 768px.

### Texturas (`public/textures/`)

As imagens partem da coleção pública da NASA **Blue Marble: Next Generation**
(`world.topo.bathy.200412...`, domínio público) para o mapa-múndi e nuvens, e
de mapas de relevo/especular de uso consolidado em tutoriais three.js. Todas
mantêm proporção exata 2:1.

| Arquivo | Conteúdo | Resolução real |
|---|---|---|
| `earth_daymap_8k.jpg` / `_2k.jpg` | Cor da Terra (Blue Marble) | 5400×2700 / 2048×1024 |
| `earth_clouds_8k.jpg` / `_2k.jpg` | Nuvens | 2048×1024 / 1024×512 |
| `earth_bump_8k.jpg` / `_2k.jpg` | Relevo | 1000×500 / 500×250 |
| `earth_specular_8k.jpg` / `_2k.jpg` | Máscara de oceano | 1000×500 / 500×250 |

> Nota: os arquivos "_8k" usam a maior resolução disponível nas fontes
> públicas utilizadas (nem sempre literalmente 8192×4096) — ainda assim,
> nitidamente suficiente para o tamanho de exibição do globo no site. Se
> quiser texturas ainda maiores no futuro, basta substituir os arquivos
> mantendo a proporção 2:1 e os mesmos nomes.

Se um arquivo de textura estiver ausente, o componente **não** usa uma cor
sólida de fallback silenciosa: ele registra no console um erro específico
indicando exatamente qual arquivo não foi encontrado.

## Pendências de conteúdo do cliente

- **Telefone do WhatsApp**: troque a constante `WHATSAPP_NUMBER` em
  `src/lib/constants.ts` (está como `55XXXXXXXXXXX`).
- **CNPJ**: troque `CNPJ_PLACEHOLDER` em `src/lib/constants.ts`.
- **E-mail e Instagram**: confirme/ajuste `CONTACT_EMAIL`, `INSTAGRAM_HANDLE`
  e `INSTAGRAM_URL` em `src/lib/constants.ts`.
- **Foto vertical de natureza brasileira** (seção "Quem somos"): hoje é um
  bloco `MediaPlaceholder`. Substitua por um `<img>` real em `About.tsx`.
- **Vídeos** do Festival de Parintins e do Rio de Janeiro (aéreo/piscina):
  hoje são blocos `MediaPlaceholder`. Em `Experiences.tsx`, coloque os
  arquivos em `public/media/`, defina `videoSrc`/`poster` e mude
  `videoAvailable` para `true` em cada item.
- **Logotipo**: o emblema atual (`src/components/Logo.tsx`) é uma
  reinterpretação vetorial do logotipo do cliente (arara estilizada), feita
  à mão em SVG porque o arquivo original não foi fornecido em formato
  vetorial/imagem anexável ao projeto. Substitua pelo arquivo oficial
  (idealmente SVG) assim que disponível.
