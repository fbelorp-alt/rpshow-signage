import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute } from "wouter";
import { useGetPlayerPlaylist, getGetPlayerPlaylistQueryKey } from "@workspace/api-client-react";
import { MonitorX, Loader2 } from "lucide-react";

export default function Player() {
  const [, params] = useRoute("/player/:code");
  const code = params?.code || "";

  const { data: payload, isLoading, isError } = useGetPlayerPlaylist(code, {
    query: {
      enabled: !!code,
      queryKey: getGetPlayerPlaylistQueryKey(code),
      refetchInterval: 60000,
    },
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = payload?.items || [];
  const currentItem = items[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(items.length, 1));
  }, [items.length]);

  // When item changes, handle playback
  useEffect(() => {
    if (!currentItem) return;

    // Clear any previous image timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (currentItem.mediaType === "video") {
      // Give the DOM a tick to update, then play
      const raf = requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play().catch(() => {
            // Autoplay blocked — fall back to duration timer
            const fallbackMs = (currentItem.durationSeconds || 10) * 1000;
            timerRef.current = setTimeout(goNext, fallbackMs);
          });
        }
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Image: advance after durationSeconds
      const durationMs = (currentItem.durationSeconds || 10) * 1000;
      timerRef.current = setTimeout(goNext, durationMs);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [currentIndex, currentItem, goNext]);

  // Reset index if items change and current index is out of bounds
  useEffect(() => {
    if (items.length > 0 && currentIndex >= items.length) {
      setCurrentIndex(0);
    }
  }, [items.length, currentIndex]);

  if (isLoading && !payload) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-xl font-medium tracking-tight">Carregando...</p>
      </div>
    );
  }

  if (isError || !payload) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-600">
        <MonitorX className="w-16 h-16 mb-4 opacity-50" />
        <h1 className="text-2xl font-bold text-white">Tela nao encontrada</h1>
        <p className="text-sm mt-2 opacity-70 text-white">Verifique o codigo da tela</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-600">
        <MonitorX className="w-16 h-16 mb-4 opacity-50" />
        <h1 className="text-3xl font-bold text-white">{payload.screenName}</h1>
        <p className="text-xl mt-4 opacity-70 text-white">Nenhum conteudo agendado</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative cursor-none">
      {currentItem && (
        <div className="absolute inset-0 flex items-center justify-center">
          {currentItem.mediaType === "video" ? (
            <video
              key={`video-${currentIndex}-${currentItem.mediaUrl}`}
              ref={videoRef}
              src={currentItem.mediaUrl}
              className="w-full h-full object-contain"
              muted
              playsInline
              onEnded={goNext}
              onError={goNext}
            />
          ) : (
            <img
              key={`img-${currentIndex}-${currentItem.mediaUrl}`}
              src={currentItem.mediaUrl}
              alt={currentItem.mediaName || ""}
              className="w-full h-full object-contain"
              onError={goNext}
            />
          )}
        </div>
      )}
    </div>
  );
}
