import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { clamp } from "../../lib/geo";

export type CenterRequest = { lat: number; lon: number; nonce: number };

type RotationRigProps = {
  reducedMotion: boolean;
  centerRequest: CenterRequest | null;
  onCenteringChange: (animating: boolean) => void;
  radius: number;
  children: ReactNode;
};

const AUTO_ROTATE_SPEED = 0.0008; // rad/frame, conforme especificado
const DRAG_SENSITIVITY = 0.006;
const PITCH_LIMIT = 0.8; // rad — nunca deixa aparecer o achatamento dos polos

/**
 * Controla a rotação do globo: giro automático lento, arraste com
 * mouse/toque (com a inclinação vertical travada) e a animação suave de
 * centralização quando um marcador é selecionado.
 */
export default function RotationRig({
  reducedMotion,
  centerRequest,
  onCenteringChange,
  radius,
  children,
}: RotationRigProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotation = useRef({ yaw: 0, pitch: 0 });
  const target = useRef<{ yaw: number; pitch: number } | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!centerRequest || centerRequest.nonce === lastNonce.current) return;
    lastNonce.current = centerRequest.nonce;

    // Mesma conversão lat/lon -> vetor usada nos marcadores, decomposta para
    // encontrar o yaw (giro em Y) e o pitch (giro em X) que trazem o ponto
    // exatamente para o eixo da câmera (0, 0, r).
    const latRad = (centerRequest.lat * Math.PI) / 180;
    const phi = (90 - centerRequest.lat) * (Math.PI / 180);
    const theta = (centerRequest.lon + 180) * (Math.PI / 180);
    const x0 = -Math.sin(phi) * Math.cos(theta);
    const z0 = Math.sin(phi) * Math.sin(theta);

    const yaw = Math.atan2(-x0, z0);
    const pitch = clamp(latRad, -PITCH_LIMIT, PITCH_LIMIT);

    target.current = { yaw, pitch };
    onCenteringChange(true);
  }, [centerRequest, onCenteringChange]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (target.current) {
      const t = target.current;
      let diffYaw = t.yaw - rotation.current.yaw;
      diffYaw = Math.atan2(Math.sin(diffYaw), Math.cos(diffYaw)); // caminho mais curto
      const ease = Math.min(1, delta * 2.4);
      rotation.current.yaw += diffYaw * ease;
      rotation.current.pitch += (t.pitch - rotation.current.pitch) * ease;

      if (Math.abs(diffYaw) < 0.002 && Math.abs(t.pitch - rotation.current.pitch) < 0.002) {
        rotation.current.yaw = t.yaw;
        rotation.current.pitch = t.pitch;
        target.current = null;
        onCenteringChange(false);
      }
    } else if (!dragging.current && !reducedMotion) {
      rotation.current.yaw += AUTO_ROTATE_SPEED;
    }

    group.rotation.order = "YXZ";
    group.rotation.y = rotation.current.yaw;
    group.rotation.x = rotation.current.pitch;
  });

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    dragging.current = true;
    target.current = null;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragging.current) return;
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    rotation.current.yaw += dx * DRAG_SENSITIVITY;
    rotation.current.pitch = clamp(
      rotation.current.pitch - dy * DRAG_SENSITIVITY,
      -PITCH_LIMIT,
      PITCH_LIMIT
    );
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  return (
    <group>
      <group ref={groupRef}>{children}</group>

      {/* Esfera invisível, um pouco maior que a atmosfera, só para capturar o arraste. */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <sphereGeometry args={[radius * 1.3, 24, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
