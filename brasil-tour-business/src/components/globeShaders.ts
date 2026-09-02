// Shader Fresnel clássico para o halo atmosférico: quanto mais rasante o
// ângulo entre a normal e a direção da câmera, mais intensa a borda azul.
export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 4.5);
    gl_FragColor = vec4(glowColor, fresnel * intensity);
  }
`;
