import { useMemo } from "react";
import * as THREE from "three";
import { atmosphereFragmentShader, atmosphereVertexShader } from "../globeShaders";

type AtmosphereProps = {
  radius: number;
};

/** Halo azul na borda do planeta — esfera maior, vista por dentro, com efeito Fresnel aditivo. */
export default function Atmosphere({ radius }: AtmosphereProps) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color("#5C93D6") },
      intensity: { value: 0.9 },
    }),
    []
  );

  return (
    <mesh scale={radius}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
