import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * Mapa em memória de uploads pendentes (uploadId → gcsFullPath/localPath + contentType).
 * O browser faz PUT para /api/storage/uploads/proxy/:uploadId (mesma origem, sem CORS).
 * A nossa API faz o upload real para o GCS ou disco local, dependendo do modo.
 */
const pendingUploads = new Map<string, {
  gcsFullPath: string;
  contentType: string;
  expiresAt: number;
}>();

// Limpa uploads expirados a cada 5 min
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of pendingUploads) {
    if (data.expiresAt < now) pendingUploads.delete(id);
  }
}, 5 * 60 * 1000).unref();

/**
 * POST /storage/uploads/request-url
 *
 * Retorna uma URL de upload proxy (nossa própria API).
 * O browser faz PUT para essa URL — sem CORS pois é mesma origem.
 * A API faz o upload para o GCS (Replit) ou disco local (VPS) internamente.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadId = randomUUID();
    const { gcsFullPath, objectPath } = objectStorageService.createPendingUpload(uploadId);

    pendingUploads.set(uploadId, {
      gcsFullPath,
      contentType: contentType ?? "application/octet-stream",
      expiresAt: Date.now() + 900_000, // 15 min
    });

    // URL absoluta usando o mesmo host/protocolo da requisição atual
    // Garante que o Uppy saiba exatamente onde fazer o PUT
    const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
    const host = (req.headers["x-forwarded-host"] as string) ?? req.get("host") ?? "";
    const uploadURL = host
      ? `${proto}://${host}/api/storage/uploads/proxy/${uploadId}`
      : `/api/storage/uploads/proxy/${uploadId}`;

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error creating pending upload");
    res.status(500).json({ error: "Failed to create upload session" });
  }
});

/**
 * PUT /storage/uploads/proxy/:uploadId
 *
 * Recebe o arquivo binário do browser e faz o upload para GCS ou disco local.
 * O body chega como stream (Express não parseia binary quando Content-Type é video/mp4, etc.).
 */
router.put("/storage/uploads/proxy/:uploadId", async (req: Request, res: Response) => {
  const uploadId = req.params["uploadId"] as string;
  const pending = pendingUploads.get(uploadId);

  if (!pending || pending.expiresAt < Date.now()) {
    res.status(410).json({ error: "Upload URL expirou. Tente novamente." });
    return;
  }

  pendingUploads.delete(uploadId);

  try {
    const contentType = req.headers["content-type"] ?? pending.contentType;
    await objectStorageService.uploadObjectFromStream(pending.gcsFullPath, contentType, req);
    res.status(200).json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Proxy upload to storage failed");
    res.status(500).json({ error: "Falha ao salvar arquivo no storage" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params["filePath"];
    const filePath = Array.isArray(raw) ? raw.join("/") : (raw as string);
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Modo Replit (PRIVATE_OBJECT_DIR configurado):
 *   Redireciona (302) para URL assinada GCS. Player streama direto do CDN.
 *
 * Modo local (VPS sem PRIVATE_OBJECT_DIR):
 *   Faz streaming direto do arquivo em disco via Node.js.
 *   Suporta Range requests para seeking de vídeo.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  const raw = req.params["path"];
  const wildcardPath = Array.isArray(raw) ? raw.join("/") : (raw as string);
  const objectPath = `/objects/${wildcardPath}`;

  // Modo local: serve arquivo do disco
  if (objectStorageService.isLocalMode()) {
    try {
      const localPath = objectStorageService.getLocalFilePath(objectPath);

      if (!fs.existsSync(localPath)) {
        res.status(404).json({ error: "Object not found" });
        return;
      }

      const stat = fs.statSync(localPath);
      const fileSize = stat.size;
      const ext = path.extname(localPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
      };
      const contentType = mimeTypes[ext] ?? "application/octet-stream";

      const rangeHeader = req.headers["range"];

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0] ?? "0", 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
        });
        fs.createReadStream(localPath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        });
        fs.createReadStream(localPath).pipe(res);
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving local object");
      res.status(500).json({ error: "Failed to serve object" });
    }
    return;
  }

  // Modo Replit: redireciona para URL assinada GCS
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const signedUrl = await objectStorageService.getSignedReadUrl(objectFile, 7200);

    res.setHeader("Cache-Control", "private, max-age=3600");
    res.redirect(302, signedUrl);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
