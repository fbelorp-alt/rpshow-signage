import { Vector3 } from "three";

/**
 * Converte latitude/longitude (graus) em posição 3D sobre uma esfera de raio `r`,
 * usando a mesma convenção de mapeamento UV equiretangular do three.js.
 */
export function latLonToVector3(lat: number, lon: number, r: number): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new Vector3(x, y, z);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
