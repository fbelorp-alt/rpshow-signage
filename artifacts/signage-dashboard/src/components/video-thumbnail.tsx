import { useState } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoThumbnailProps {
  url: string;
  className?: string;
}

export function VideoThumbnail({ url, className }: VideoThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative bg-black overflow-hidden", className)}>
      {/* Fallback icon — shown while loading or on error */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 pointer-events-none">
          <Film className={cn(
            "w-1/3 h-1/3 min-w-3 min-h-3",
            failed ? "text-white/20" : "text-white/40 animate-pulse"
          )} />
        </div>
      )}

      {!failed && (
        <video
          src={url}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={e => {
            // Seek to 10% of duration (or 1s max) to show a representative frame
            const v = e.currentTarget;
            v.currentTime = Math.min(1, (v.duration || 0) * 0.1);
          }}
          onSeeked={e => {
            // Video seeked to the desired frame — show it
            e.currentTarget.pause();
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      {/* Film icon overlay on loaded thumbnail */}
      {loaded && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5 pointer-events-none z-10">
          <Film className="w-2.5 h-2.5 text-white/70 drop-shadow" />
        </div>
      )}
    </div>
  );
}
