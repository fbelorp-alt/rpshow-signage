import { useState, useEffect, useRef } from "react";
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
      refetchInterval: 60000 // poll every 60 seconds
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const items = payload?.items || [];
  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!items.length) return;
    
    // Ensure index is valid after refetch
    if (currentIndex >= items.length) {
      setCurrentIndex(0);
      return;
    }

    const item = items[currentIndex];
    
    if (item.mediaType === 'image') {
      const durationMs = (item.durationSeconds || 10) * 1000;
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
      }, durationMs);
      return () => clearTimeout(timer);
    }
    // For video, we rely on the onEnded event of the video element
  }, [currentIndex, items]);

  const handleVideoEnded = () => {
    if (items.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }
  };

  if (isLoading && !payload) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="w-12 h-12 animate-spin mb-4" />
        <p className="text-xl font-medium tracking-tight">Initializing Player</p>
      </div>
    );
  }

  if (isError || !payload) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-600">
        <MonitorX className="w-16 h-16 mb-4 opacity-50" />
        <h1 className="text-2xl font-bold">Screen Not Found</h1>
        <p className="text-sm mt-2 opacity-70">Check your pairing code</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-zinc-600">
        <MonitorX className="w-16 h-16 mb-4 opacity-50" />
        <h1 className="text-3xl font-bold">{payload.screenName}</h1>
        <p className="text-xl mt-4 opacity-70">No active content assigned</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative cursor-none">
      {items.map((item, idx) => (
        <div 
          key={`${item.mediaUrl}-${idx}`}
          className={`absolute inset-0 transition-opacity duration-1000 flex items-center justify-center ${idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          {item.mediaType === 'video' ? (
            <video
              src={item.mediaUrl}
              className="w-full h-full object-contain"
              autoPlay={idx === currentIndex}
              muted
              playsInline
              onEnded={idx === currentIndex ? handleVideoEnded : undefined}
            />
          ) : (
            <img
              src={item.mediaUrl}
              alt={item.mediaName || "Media item"}
              className="w-full h-full object-contain"
            />
          )}
        </div>
      ))}
    </div>
  );
}
