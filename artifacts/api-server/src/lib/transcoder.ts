import { spawn } from "node:child_process";
import fs from "node:fs";

const VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/avi",
  "video/webm",
  "video/x-matroska",
  "video/mpeg",
  "video/3gpp",
]);

const TARGET_BITRATE_KBPS = 3000;
const MIN_SIZE_TO_TRANSCODE = 15 * 1024 * 1024; // só transcoda se > 15MB

export function isVideoContentType(contentType: string): boolean {
  return VIDEO_CONTENT_TYPES.has(contentType.split(";")[0].trim().toLowerCase());
}

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

export async function transcodeVideoIfNeeded(
  localPath: string,
  contentType: string,
  log?: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  if (!isVideoContentType(contentType)) return;

  const stat = fs.statSync(localPath);
  if (stat.size < MIN_SIZE_TO_TRANSCODE) {
    log?.info(`[transcode] skip — ${Math.round(stat.size / 1024 / 1024)}MB < 15MB`);
    return;
  }

  const ok = await ffmpegAvailable();
  if (!ok) {
    log?.error("[transcode] ffmpeg não encontrado no PATH — instale: apt install ffmpeg");
    return;
  }

  const tmpPath = localPath + ".transcoding.mp4";
  const sizeMb = Math.round(stat.size / 1024 / 1024);
  log?.info(`[transcode] iniciando ${sizeMb}MB → alvo ${TARGET_BITRATE_KBPS}kbps`);

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-i", localPath,
      "-c:v", "libx264",
      "-b:v", `${TARGET_BITRATE_KBPS}k`,
      "-maxrate", `${Math.round(TARGET_BITRATE_KBPS * 1.5)}k`,
      "-bufsize", `${TARGET_BITRATE_KBPS * 2}k`,
      "-preset", "fast",
      "-an",
      "-movflags", "+faststart",
      "-y",
      tmpPath,
    ];

    const proc = spawn("ffmpeg", args, { stdio: "pipe" });
    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-400)}`));
    });
    proc.on("error", reject);
  }).then(() => {
    const newStat = fs.statSync(tmpPath);
    const newMb = Math.round(newStat.size / 1024 / 1024);
    if (newStat.size >= stat.size) {
      log?.info(`[transcode] ignorado — resultado ${newMb}MB >= original ${sizeMb}MB (já otimizado)`);
      fs.unlinkSync(tmpPath);
      return;
    }
    log?.info(`[transcode] concluído: ${sizeMb}MB → ${newMb}MB`);
    fs.renameSync(tmpPath, localPath);
  }).catch((err: Error) => {
    log?.error(`[transcode] falhou: ${err.message}`);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
  });
}
