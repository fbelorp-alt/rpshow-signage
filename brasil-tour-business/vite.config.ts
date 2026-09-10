import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Ver src/components/globe/textureSource.default.ts — usa arquivos de
      // textura separados em public/textures/ (build normal do site).
      "@texture-source": fileURLToPath(
        new URL("./src/components/globe/textureSource.default.ts", import.meta.url)
      ),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa o motor 3D (só carregado quando o globo entra em cena) do
          // restante do app, para não atrasar a primeira pintura da página.
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
