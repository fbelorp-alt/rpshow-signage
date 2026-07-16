import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
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
 * Mapa em memória de uploads pendentes (uploadId → gcsFullPath + contentType).
 * O browser faz PUT para /api/storage/uploads/proxy/:uploadId (mesma origem, sem CORS).
 * A nossa API faz o upload real para o GCS server-side.
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
 * A API faz o upload para o GCS internamente.
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

    // URL relativa — funciona em dev (Replit proxy) e prod (Nginx mesmo domínio)
    const uploadURL = `/api/storage/uploads/proxy/${uploadId}`;

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
 * Recebe o arquivo binário do browser e faz o upload para o GCS server-side.
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
    req.log.error({ err: error }, "Proxy upload to GCS failed");
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
 * Redireciona (302) para uma URL assinada diretamente no GCS.
 * O player (ExoPlayer / browser) recebe o redirect e streama direto do CDN
 * do Google Cloud Storage — sem proxy pelo Node.js, sem gargalo de banda.
 *
 * GCS suporta Range requests nativamente: seeking de vídeo funciona igual.
 * A URL assinada expira em 2h (tempo suficiente para qualquer vídeo de signage).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params["path"];
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : (raw as string);
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const signedUrl = await objectStorageService.getSignedReadUrl(objectFile, 7200);

    // Redireciona direto pro CDN — ExoPlayer segue o redirect e streama sem
    // passar pelo Node.js. Cache-Control no header instrui o HTTP client
    // a reutilizar a URL assinada por até 1h sem pedir nova.
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
