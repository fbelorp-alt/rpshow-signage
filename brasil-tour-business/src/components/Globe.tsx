import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import Stars from "./globe/Stars";
import EarthBody from "./globe/EarthBody";
import Clouds from "./globe/Clouds";
import Atmosphere from "./globe/Atmosphere";
import Markers from "./globe/Markers";
import RotationRig, { type CenterRequest } from "./globe/RotationRig";
import { useEarthTextures, type EarthTextureUrls } from "./globe/useEarthTextures";
import { getTextureUrls } from "@texture-source";
import DestinationPanel from "./DestinationPanel";
import { useIsMobile } from "../lib/useIsMobile";
import { useReducedMotion } from "../lib/useReducedMotion";
import { ALL_MARKERS, type FlatMarker, type Market } from "../data/destinations";

const RADIUS = 1;

// `@texture-source` aponta para um módulo diferente conforme o build:
// arquivos separados em produção normal, ou texturas embutidas em base64
// no build "standalone" (arquivo único aberto por duplo-clique).
const HI_RES_URLS: EarthTextureUrls = getTextureUrls(false);
const LOW_RES_URLS: EarthTextureUrls = getTextureUrls(true);

type SceneProps = {
  urls: EarthTextureUrls;
  cloudOpacity: number;
  reducedMotion: boolean;
  centerRequest: CenterRequest | null;
  onCenteringChange: (animating: boolean) => void;
  activeMarketId: string | null;
  onSelectMarker: (marker: FlatMarker) => void;
  onProgress: (progress: number) => void;
  onError: (message: string) => void;
  onReady: () => void;
  portalRef: RefObject<HTMLDivElement | null>;
};

function Scene({
  urls,
  cloudOpacity,
  reducedMotion,
  centerRequest,
  onCenteringChange,
  activeMarketId,
  onSelectMarker,
  onProgress,
  onError,
  onReady,
  portalRef,
}: SceneProps) {
  const { gl } = useThree();
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  const { textures, progress, error } = useEarthTextures(urls, maxAnisotropy);

  useEffect(() => onProgress(progress), [progress, onProgress]);
  useEffect(() => {
    if (error) onError(error);
  }, [error, onError]);
  useEffect(() => {
    if (textures) onReady();
  }, [textures, onReady]);

  return (
    <>
      {/* Luz direcional cria o terminador dia/noite ao girar o globo.
          Posicionada quase de frente para a câmera para que o hemisfério
          visível fique bem iluminado na maior parte do giro, com o
          terminador aparecendo de forma sutil nas bordas. */}
      <directionalLight color="#ffffff" intensity={1.6} position={[-0.4, 0.5, 5]} />
      {/* Luz ambiente fraca e azulada: o lado noturno não fica preto absoluto */}
      <ambientLight color="#2A3D55" intensity={0.7} />

      <Stars />

      {textures ? (
        <RotationRig
          radius={RADIUS}
          reducedMotion={reducedMotion}
          centerRequest={centerRequest}
          onCenteringChange={onCenteringChange}
        >
          <EarthBody textures={textures} />
          <Clouds
            texture={textures.clouds}
            radius={RADIUS * 1.015}
            opacity={cloudOpacity}
            spinning={!reducedMotion}
          />
          <Atmosphere radius={RADIUS * 1.12} />
          <Markers
            markers={ALL_MARKERS}
            radius={RADIUS}
            activeMarketId={activeMarketId}
            onSelect={onSelectMarker}
            portalRef={portalRef}
          />
        </RotationRig>
      ) : null}
    </>
  );
}

export default function Globe() {
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();

  const [progress, setProgress] = useState(0);
  const [textureError, setTextureError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [activeMarket, setActiveMarket] = useState<Market | null>(null);
  const [centerRequest, setCenterRequest] = useState<CenterRequest | null>(null);
  const [centering, setCentering] = useState(false);
  const nonceRef = useRef(0);
  const portalRef = useRef<HTMLDivElement | null>(null);

  const handleSelectMarker = useCallback((marker: FlatMarker) => {
    nonceRef.current += 1;
    setCenterRequest({ lat: marker.lat, lon: marker.lon, nonce: nonceRef.current });
    setActiveMarket(marker.market);
  }, []);

  const handleClosePanel = useCallback(() => setActiveMarket(null), []);
  const handleCenteringChange = useCallback((animating: boolean) => setCentering(animating), []);
  const handleProgress = useCallback((p: number) => setProgress(p), []);
  const handleError = useCallback((message: string) => setTextureError(message), []);
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[640px]">
      <div aria-hidden="true" className="absolute inset-0">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0, 3.1], fov: 42 }}
        >
          <Scene
            urls={isMobile ? LOW_RES_URLS : HI_RES_URLS}
            cloudOpacity={isMobile ? 0.6 : 0.75}
            reducedMotion={reducedMotion}
            centerRequest={centerRequest}
            onCenteringChange={handleCenteringChange}
            activeMarketId={activeMarket?.id ?? null}
            onSelectMarker={handleSelectMarker}
            onProgress={handleProgress}
            onError={handleError}
            onReady={handleReady}
            portalRef={portalRef}
          />
        </Canvas>
      </div>

      {/* Alvo para onde os marcadores HTML são portados — mesma área do canvas,
          mas fora da div aria-hidden, para permanecerem acessíveis. */}
      <div ref={portalRef} className="pointer-events-none absolute inset-0" />

      {!ready && !textureError ? (
        <div className="absolute inset-x-10 bottom-6 h-[2px] overflow-hidden bg-white/10">
          <div
            className="texture-loading-bar"
            style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
          />
        </div>
      ) : null}

      {textureError ? (
        <p role="alert" className="absolute inset-x-6 bottom-6 text-[11px] text-red-300">
          Não foi possível carregar as texturas do globo. Veja o console para detalhes.
        </p>
      ) : null}

      {centering ? <span className="sr-only" role="status">Centralizando destino selecionado no globo</span> : null}

      <DestinationPanel market={activeMarket} onClose={handleClosePanel} />
    </div>
  );
}
