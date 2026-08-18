import type { EarthTextureUrls } from "./useEarthTextures";

// Prefixo `BASE_URL`: em produção normal é "/". As texturas ficam como
// arquivos separados em `public/textures/`, carregados sob demanda.
const BASE = import.meta.env.BASE_URL;

const HI_RES_URLS: EarthTextureUrls = {
  map: `${BASE}textures/earth_daymap_8k.jpg`,
  bump: `${BASE}textures/earth_bump_8k.jpg`,
  specular: `${BASE}textures/earth_specular_8k.jpg`,
  clouds: `${BASE}textures/earth_clouds_8k.jpg`,
};

const LOW_RES_URLS: EarthTextureUrls = {
  map: `${BASE}textures/earth_daymap_2k.jpg`,
  bump: `${BASE}textures/earth_bump_2k.jpg`,
  specular: `${BASE}textures/earth_specular_2k.jpg`,
  clouds: `${BASE}textures/earth_clouds_2k.jpg`,
};

export function getTextureUrls(isMobile: boolean): EarthTextureUrls {
  return isMobile ? LOW_RES_URLS : HI_RES_URLS;
}
