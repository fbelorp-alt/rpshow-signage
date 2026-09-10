import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build alternativo que gera um único arquivo HTML (JS, CSS e as texturas
// do globo em 2K, tudo embutido em base64), pensado para ser aberto com
// duplo clique direto no navegador — sem precisar de servidor nem de
// arquivos externos ao lado.
//
// Uso: npm run build:standalone  →  gera dist-standalone/index.html
export default defineConfig({
  base: "./",
  // Não copia public/ (texturas, mídia) — tudo que é usado já está embutido
  // como base64 pelo textureSource.standalone.ts. Resultado: só o index.html.
  publicDir: false,
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      // Ver src/components/globe/textureSource.standalone.ts — embute as
      // texturas 2K como data URI para não depender de requisições de
      // arquivo (bloqueadas por CORS quando a página é aberta via file://).
      "@texture-source": fileURLToPath(
        new URL("./src/components/globe/textureSource.standalone.ts", import.meta.url)
      ),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    outDir: "dist-standalone",
    cssCodeSplit: false,
    assetsInlineLimit: 100 * 1024 * 1024,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
