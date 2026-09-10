import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { latLonToVector3 } from "../../lib/geo";
import type { FlatMarker } from "../../data/destinations";

type MarkersProps = {
  markers: FlatMarker[];
  radius: number;
  activeMarketId: string | null;
  onSelect: (marker: FlatMarker) => void;
  portalRef: RefObject<HTMLDivElement | null>;
};

export default function Markers({ markers, radius, activeMarketId, onSelect, portalRef }: MarkersProps) {
  return (
    <>
      {markers.map((marker) => (
        <MarkerPoint
          key={marker.id}
          marker={marker}
          radius={radius}
          isActive={activeMarketId === marker.market.id}
          onSelect={onSelect}
          portalRef={portalRef}
        />
      ))}
    </>
  );
}

type MarkerPointProps = {
  marker: FlatMarker;
  radius: number;
  isActive: boolean;
  onSelect: (marker: FlatMarker) => void;
  portalRef: RefObject<HTMLDivElement | null>;
};

const _worldPos = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _viewDir = new THREE.Vector3();

function MarkerPoint({ marker, radius, isActive, onSelect, portalRef }: MarkerPointProps) {
  const anchorRef = useRef<THREE.Group>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const { camera } = useThree();

  const position = useMemo(
    () => latLonToVector3(marker.lat, marker.lon, radius * 1.004),
    [marker.lat, marker.lon, radius]
  );

  // Marcador some quando está do lado oposto do globo: comparamos a normal
  // do ponto (posição normalizada, já que a esfera é centrada na origem)
  // com a direção até a câmera. Produto escalar negativo = lado escondido.
  // Exceção: se o marcador estiver focado via teclado, ele permanece visível
  // — navegação por teclado não deve depender da rotação atual do globo.
  useFrame(() => {
    const anchor = anchorRef.current;
    const wrapper = wrapperRef.current;
    if (!anchor || !wrapper) return;

    anchor.getWorldPosition(_worldPos);
    _normal.copy(_worldPos).normalize();
    _viewDir.copy(camera.position).sub(_worldPos).normalize();
    const facingCamera = _normal.dot(_viewDir) > 0.08;
    const visible = facingCamera || focusedRef.current;

    wrapper.style.opacity = visible ? "1" : "0";
    wrapper.style.pointerEvents = visible ? "auto" : "none";
  });

  return (
    <group ref={anchorRef} position={position}>
      <Html
        center
        style={{ pointerEvents: "none" }}
        zIndexRange={[20, 0]}
        portal={portalRef as unknown as RefObject<HTMLElement>}
      >
        <div ref={wrapperRef} className="flex flex-col items-center" style={{ transition: "opacity 0.25s ease" }}>
          <button
            type="button"
            onClick={() => onSelect(marker)}
            onFocus={() => {
              focusedRef.current = true;
            }}
            onBlur={() => {
              focusedRef.current = false;
            }}
            aria-label={`Ver detalhes de ${marker.market.country} — ${marker.city}`}
            className={`relative h-2.5 w-2.5 rounded-full border transition-transform duration-300 before:absolute before:-inset-3 before:content-[''] hover:scale-125 ${
              isActive ? "border-gold bg-gold" : "border-gold/90 bg-sand/80"
            }`}
          />
          <span className="mt-1.5 whitespace-nowrap rounded-[2px] bg-space/75 px-1.5 py-0.5 text-[10px] uppercase tracking-label text-sand">
            {marker.city}
          </span>
        </div>
      </Html>
    </group>
  );
}
