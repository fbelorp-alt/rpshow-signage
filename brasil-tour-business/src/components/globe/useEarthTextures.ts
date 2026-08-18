import { useEffect, useState } from "react";
import * as THREE from "three";

export type EarthTextureSet = {
  map: THREE.Texture;
  bump: THREE.Texture;
  specular: THREE.Texture;
  clouds: THREE.Texture;
};

export type EarthTextureUrls = {
  map: string;
  bump: string;
  specular: string;
  clouds: string;
};

type LoadState = {
  textures: EarthTextureSet | null;
  progress: number;
  error: string | null;
};

/**
 * Carrega as texturas da Terra manualmente (sem Suspense) para podermos expor
 * uma barra de progresso discreta e, principalmente, para falhar de forma
 * visível e específica no console quando um arquivo de textura não existe —
 * conforme exigido, sem cair num fallback silencioso de cor sólida.
 */
export function useEarthTextures(urls: EarthTextureUrls, maxAnisotropy: number): LoadState {
  const [state, setState] = useState<LoadState>({ textures: null, progress: 0, error: null });

  useEffect(() => {
    let cancelled = false;
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);

    manager.onProgress = (_url, loaded, total) => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, progress: total > 0 ? loaded / total : 0 }));
    };

    manager.onError = (url) => {
      const message = `[Globe] Textura ausente ou inacessível: "${url}". Confirme se o arquivo existe em public/textures/.`;
      // eslint-disable-next-line no-console
      console.error(message);
      if (!cancelled) setState((prev) => ({ ...prev, error: message }));
    };

    const entries = Object.entries(urls) as Array<[keyof EarthTextureUrls, string]>;
    const loaded: Partial<EarthTextureSet> = {};
    let remaining = entries.length;

    entries.forEach(([key, url]) => {
      loader.load(url, (texture) => {
        if (cancelled) return;

        // Regra 2: cor correta (sem "lavar" as cores da Blue Marble).
        // Bump/especular são dados de altura/máscara, não cor — mantidos em espaço linear.
        texture.colorSpace = key === "map" || key === "clouds" ? THREE.SRGBColorSpace : THREE.NoColorSpace;

        // Regra 3: nitidez dos continentes quando o globo é visto de raspão.
        texture.anisotropy = maxAnisotropy;

        loaded[key] = texture;
        remaining -= 1;

        if (remaining === 0) {
          setState({ textures: loaded as EarthTextureSet, progress: 1, error: null });
        }
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.map, urls.bump, urls.specular, urls.clouds, maxAnisotropy]);

  return state;
}
