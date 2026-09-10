import { Router } from "express";
import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, activityTable, mediaTable, playlistItemsTable, playlistsTable, radioFavoritesTable } from "@workspace/db";

const router = Router();
const RADIO_BROWSER_HOSTS = [
  "de1.api.radio-browser.info",
  "de2.api.radio-browser.info",
  "fr1.api.radio-browser.info",
  "at1.api.radio-browser.info",
];
const RADIO_BROWSER_BASE = `https://${RADIO_BROWSER_HOSTS[0]}`;
const timeout = (ms: number) => AbortSignal.timeout(ms);

const stationSchema = z.object({
  stationuuid: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(300),
  url: z.string().url().max(2048),
  url_resolved: z.string().url().max(2048).optional().nullable(),
  favicon: z.string().url().max(2048).optional().nullable(),
  tags: z.string().max(1000).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  language: z.string().max(120).optional().nullable(),
  codec: z.string().max(40).optional().nullable(),
  bitrate: z.number().int().nonnegative().max(100000).optional().nullable(),
});
const stationInputSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  return { ...input, url: input.url ?? input.urlResolved ?? input.url_resolved };
}, stationSchema);
const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  language: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const favoriteSchema = stationSchema;
const addSchema = z.object({
  station: stationSchema,
  playlistId: z.coerce.number().int().positive(),
});

// A small, stable curated entry. It is intentionally not fetched by this API.
const MELODY = {
  stationuuid: "curated-melody",
  name: "Melody FM — Love Songs",
  url: "https://sc4s.cdn.upx.com:8080/stream",
  urlResolved: "https://sc4s.cdn.upx.com:8080/stream",
  favicon: null,
  tags: "love songs,românticas,flashback,rpshow verificada",
  country: "Brasil",
  language: "Português",
  codec: "MP3",
  bitrate: 128,
};

function userId(req: any): string {
  const user = req.user as any;
  return String(user.parentOperatorId ?? user.id);
}
function auth(req: any, res: any): string | null {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId(req);
}
function publicStation(value: unknown) {
  const parsed = stationSchema.safeParse(value);
  if (!parsed.success) return null;
  const s = parsed.data;
  return {
    stationuuid: s.stationuuid, name: s.name, url: s.url,
    urlResolved: s.url_resolved ?? s.url, favicon: s.favicon?.trim() || null,
    tags: s.tags ?? null, country: s.country ?? null, language: s.language ?? null,
    codec: s.codec ?? null, bitrate: s.bitrate ?? null,
  };
}

const visualInputSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  previewUrl: z.string().url().max(2048),
  videoUrl: z.string().url().max(2048),
  author: z.string().trim().min(1).max(200),
  sourceUrl: z.string().url().max(2048),
  playlistId: z.coerce.number().int().positive(),
});
function pexelsCdnUrl(value: string, kind: "video" | "image"): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const allowed = kind === "video"
      ? ["videos.pexels.com"]
      : ["images.pexels.com", "videos.pexels.com"];
    return allowed.includes(url.hostname.toLowerCase());
  } catch { return false; }
}
function safeStationUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    // The player opens this URL; the API never fetches or resolves station hosts.
    // Consequently DNS rebinding cannot be eliminated here (the player/network
    // remains responsible for resolving the final stream address).
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    const ipVersion = (awaitableNetIsIp(host));
    if (ipVersion === 6) {
      const compact = host.replace(/^\[|\]$/g, "");
      if (compact === "::" || compact === "::1" || compact.startsWith("fc") ||
          compact.startsWith("fd") || compact.startsWith("fe8") || compact.startsWith("fe9") ||
          compact.startsWith("fea") || compact.startsWith("feb") || compact.startsWith("ff") ||
          compact.startsWith("2001:db8")) return false;
      const mapped = compact.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
      return !mapped || !isPrivateIpv4(mapped[1]);
    }
    if (ipVersion === 4 || looksNumericHost(host)) return !isPrivateIpv4(host);
    return true;
  } catch { return false; }
}

// Avoid DNS lookups in the API: this only recognizes literal IP syntax.
function awaitableNetIsIp(host: string): 4 | 6 | 0 {
  if (/^[0-9a-f:]+$/i.test(host) && host.includes(":")) return 6;
  if (looksNumericHost(host)) return 4;
  return 0;
}
function looksNumericHost(host: string): boolean {
  return /^[0-9a-fx.]+$/i.test(host) && /[0-9]/.test(host);
}
function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  let n: number;
  if (parts.length === 1 && /^(0x[0-9a-f]+|[0-9]+)$/i.test(parts[0])) n = Number(parts[0]);
  else if (parts.length === 4 && parts.every((p) => /^(0x[0-9a-f]+|0[0-7]+|[0-9]+)$/i.test(p))) {
    const values = parts.map((p) => Number(p));
    if (values.some((p) => p > 255)) return true;
    n = values[0] * 0x1000000 + values[1] * 0x10000 + values[2] * 0x100 + values[3];
  } else return true;
  if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) return true;
  const a = (n >>> 24) & 255, b = (n >>> 16) & 255;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) || (a === 198 && b >= 18 && b <= 19) ||
    (a === 203 && b === 0) || a >= 224;
}

router.get("/catalog", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid filters", details: parsed.error.flatten() }); return; }
  const params = new URLSearchParams({ limit: String(parsed.data.limit), hidebroken: "true", order: "clickcount", reverse: "true" });
  for (const key of ["search", "tag", "country", "language"] as const) {
    const value = parsed.data[key];
    if (value) params.set(key, value);
  }
  try {
    const response = await fetch(`${RADIO_BROWSER_BASE}/json/stations/search?${params}`, {
      signal: timeout(6000), headers: { Accept: "application/json", "User-Agent": "SignageOS/1.0" },
    });
    if (!response.ok) { res.status(502).json({ error: "Radio Browser unavailable" }); return; }
    const body: unknown = await response.json();
    const stations = Array.isArray(body) ? body.map(publicStation).filter(Boolean) : [];
    // The dashboard consumes a flat list; keep curated RPShow stations in it.
    res.json([MELODY, ...stations]);
  } catch {
    res.status(504).json({ error: "Radio Browser request timed out" });
  }
});

router.get("/visuals", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const query = z.object({
    search: z.string().trim().max(100).default("relaxing nature landscapes"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid visual search", details: query.error.flatten() }); return; }
  const key = process.env.PEXELS_API_KEY;
  if (!key) { res.status(503).json({ error: "PEXELS_API_KEY not configured" }); return; }
  try {
    const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query.data.search)}&page=${query.data.page}&per_page=24&orientation=landscape`, {
      signal: timeout(7000), headers: { Authorization: key, Accept: "application/json" },
    });
    if (!response.ok) { res.status(502).json({ error: "Pexels unavailable" }); return; }
    const body: any = await response.json();
    const items = Array.isArray(body.videos) ? body.videos.flatMap((video: any) => {
      const files = Array.isArray(video.video_files) ? video.video_files
        .filter((file: any) => file?.link && file?.width >= file?.height && pexelsCdnUrl(file.link, "video"))
        .sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height)) : [];
      const videoUrl = files[0]?.link;
      if (!videoUrl) return [];
      const previewUrl = typeof video.image === "string" && pexelsCdnUrl(video.image, "image") ? video.image : null;
      if (!previewUrl) return [];
      return [{ id: video.id, title: String(video.url ?? `Pexels video ${video.id}`).split("/").pop() || "Relaxing video",
        previewUrl, videoUrl, author: String(video.user?.name ?? "Pexels"), sourceUrl: String(video.url ?? "https://www.pexels.com/videos/") }];
    }) : [];
    res.json(items);
  } catch {
    res.status(504).json({ error: "Pexels request timed out" });
  }
});

router.get("/favorites", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const rows = await db.select().from(radioFavoritesTable)
    .where(eq(radioFavoritesTable.userId, uid)).orderBy(asc(radioFavoritesTable.createdAt));
  res.json(rows.flatMap((row) => {
    try { const station = publicStation(JSON.parse(row.stationJson)); return station ? [{ ...station, favoriteId: row.id }] : []; }
    catch { return []; }
  }));
});

router.post("/favorites", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const parsed = stationInputSchema.safeParse(req.body?.station ?? req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid station", details: parsed.error.flatten() }); return; }
  const station = publicStation(parsed.data)!;
  const [row] = await db.insert(radioFavoritesTable)
    .values({ userId: uid, stationUuid: station.stationuuid, stationJson: JSON.stringify(station) })
    .onConflictDoNothing().returning();
  if (!row) { res.status(409).json({ error: "Station already favorited" }); return; }
  res.status(201).json({ ...station, favoriteId: row.id });
});

router.delete("/favorites", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const parsed = z.object({ stationUuid: z.string().trim().min(1).max(200) }).safeParse({
    stationUuid: req.body?.stationUuid ?? req.query.stationUuid,
  });
  if (!parsed.success) { res.status(400).json({ error: "stationUuid required" }); return; }
  await db.delete(radioFavoritesTable).where(and(
    eq(radioFavoritesTable.userId, uid), eq(radioFavoritesTable.stationUuid, parsed.data.stationUuid),
  ));
  res.status(204).send();
});

router.post("/add-to-playlist", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const parsed = addSchema.extend({ station: stationInputSchema }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid station or playlistId", details: parsed.error.flatten() }); return; }
  const station = publicStation(parsed.data.station)!;
  const streamUrl = station.urlResolved || station.url;
  if (!safeStationUrl(streamUrl)) { res.status(400).json({ error: "Station URL is not allowed" }); return; }
  const [playlist] = await db.select({ id: playlistsTable.id, name: playlistsTable.name })
    .from(playlistsTable).where(and(eq(playlistsTable.id, parsed.data.playlistId), eq(playlistsTable.userId, uid)));
  if (!playlist) { res.status(404).json({ error: "Playlist not found" }); return; }
  // A playlist is a visual sequence, but radio is a singleton source: replace
  // previous radio items while leaving their media rows available elsewhere.
  const radioMedia = await db.select({ id: mediaTable.id }).from(mediaTable)
    .where(and(eq(mediaTable.userId, uid), eq(mediaTable.type, "radio")));
  if (radioMedia.length) {
    await db.delete(playlistItemsTable).where(and(
      eq(playlistItemsTable.playlistId, playlist.id),
      inArray(playlistItemsTable.mediaId, radioMedia.map((m) => m.id)),
    ));
  }
  const [existingMedia] = await db.select().from(mediaTable).where(and(
    eq(mediaTable.userId, uid), eq(mediaTable.type, "radio"), eq(mediaTable.url, streamUrl),
  )).limit(1);
  const media = existingMedia ?? (await db.insert(mediaTable).values({
    userId: uid, name: station.name, type: "radio", url: streamUrl,
    thumbnailUrl: station.favicon, durationSeconds: 10, metaJson: JSON.stringify(station),
  }).returning())[0];
  const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, playlist.id));
  const [item] = await db.insert(playlistItemsTable).values({
    playlistId: playlist.id, mediaId: media.id, position: count, durationSeconds: 10,
  }).returning();
  await db.insert(activityTable).values({ userId: uid, action: "created", entityType: "media", entityName: station.name, entityId: media.id, playlistId: playlist.id });
  res.status(201).json({ media, item, playlistId: playlist.id });
});

router.post("/add-visual-to-playlist", async (req, res) => {
  const uid = auth(req, res); if (!uid) return;
  const parsed = visualInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid visual or playlistId", details: parsed.error.flatten() }); return; }
  if (!pexelsCdnUrl(parsed.data.videoUrl, "video") || !pexelsCdnUrl(parsed.data.previewUrl, "image")) {
    res.status(400).json({ error: "Visual URL is not an allowed Pexels CDN URL" }); return;
  }
  const [playlist] = await db.select({ id: playlistsTable.id }).from(playlistsTable)
    .where(and(eq(playlistsTable.id, parsed.data.playlistId), eq(playlistsTable.userId, uid)));
  if (!playlist) { res.status(404).json({ error: "Playlist not found" }); return; }
  const [media] = await db.insert(mediaTable).values({
    userId: uid, name: parsed.data.title, type: "video", url: parsed.data.videoUrl,
    thumbnailUrl: parsed.data.previewUrl, durationSeconds: 10,
    metaJson: JSON.stringify({ attribution: { author: parsed.data.author, sourceUrl: parsed.data.sourceUrl, provider: "Pexels" }, pexelsId: parsed.data.id }),
  }).returning();
  const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(playlistItemsTable).where(eq(playlistItemsTable.playlistId, playlist.id));
  const [item] = await db.insert(playlistItemsTable).values({
    playlistId: playlist.id, mediaId: media.id, position: count, durationSeconds: 10,
  }).returning();
  res.status(201).json({ media, item, playlistId: playlist.id });
});

export default router;