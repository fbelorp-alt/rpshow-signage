import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import * as THREE from "three";

type CloudsProps = {
  texture: THREE.Texture;
  radius: number;
  opacity: number;
  spinning: boolean;
};

/** Camada de nuvens: esfera 1,5% maior que a Terra, levemente mais rápida. */
export default function Clouds({ texture, radius, opacity, spinning }: CloudsProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame(() => {
    if (spinning && meshRef.current) {
      meshRef.current.rotation.y += 0.001; // um pouco mais rápido que a Terra (0.0008)
    }
  });

  return (
    <mesh ref={meshRef} scale={radius}>
      <sphereGeometry args={[1, 128, 128]} />
      <meshPhongMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}
