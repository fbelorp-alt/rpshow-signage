import { useState, useRef, useEffect } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoThumbnailProps {
  url: string;
  className?: string;
}

export function VideoThumbnail({ url, className }: VideoThumbnailProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setThumbUrl(null);
    setFailed(false);
  }, [url]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(1, video.duration > 0 ? video.duration * 0.1 : 0);
  };

  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setFailed(true); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setThumbUrl(dataUrl);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className={cn("relative bg-black overflow-hidden", className)}>
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <Film className={cn(
            "w-1/3 h-1/3 min-w-3 min-h-3",
            failed ? "text-white/20" : "text-white/40 animate-pulse"
          )} />
        </div>
      )}
      {thumbUrl && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5">
          <Film className="w-2.5 h-2.5 text-white/70 drop-shadow" />
        </div>
      )}
      {!failed && (
        <video
          ref={videoRef}
          src={url}
          crossOrigin="anonymous"
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          onSeeked={handleSeeked}
          onError={() => setFailed(true)}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
        />
      )}
    </div>
  );
}
