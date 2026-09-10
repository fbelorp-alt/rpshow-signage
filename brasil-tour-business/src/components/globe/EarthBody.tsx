import * as THREE from "three";
import type { EarthTextureSet } from "./useEarthTextures";

type EarthBodyProps = {
  textures: EarthTextureSet;
};

/**
 * A Terra em si: esfera com 128x128 segmentos (obrigatório para a textura
 * equiretangular 2:1 se projetar sem emendas ou distorção nos polos),
 * cor (map), relevo (bumpMap) e brilho apenas no oceano (specularMap).
 */
export default function EarthBody({ textures }: EarthBodyProps) {
  return (
    <mesh>
      <sphereGeometry args={[1, 128, 128]} />
      <meshPhongMaterial
        map={textures.map}
        bumpMap={textures.bump}
        bumpScale={0.04}
        specularMap={textures.specular}
        specular={new THREE.Color("#333333")}
        shininess={12}
      />
    </mesh>
  );
}
