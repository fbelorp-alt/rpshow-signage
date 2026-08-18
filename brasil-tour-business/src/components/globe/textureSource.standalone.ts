import type { EarthTextureUrls } from "./useEarthTextures";

// Build "standalone" (arquivo único, aberto por duplo-clique via file://):
// carregar as texturas como arquivos separados falha, porque o
// THREE.TextureLoader pede a imagem com CORS habilitado e o navegador
// bloqueia qualquer requisição file://→file:// nesse modo ("origin null").
// A saída é embutir as texturas como data URI (base64) — esquema isento
// dessa restrição — diretamente no próprio HTML. Por isso usamos aqui as
// versões 2K (mais leves) em vez das 8K.
import daymap from "../../../public/textures/earth_daymap_2k.jpg?inline";
import bump from "../../../public/textures/earth_bump_2k.jpg?inline";
import specular from "../../../public/textures/earth_specular_2k.jpg?inline";
import clouds from "../../../public/textures/earth_clouds_2k.jpg?inline";

const EMBEDDED_URLS: EarthTextureUrls = { map: daymap, bump, specular, clouds };

export function getTextureUrls(_isMobile: boolean): EarthTextureUrls {
  return EMBEDDED_URLS;
}
