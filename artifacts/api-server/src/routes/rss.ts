import { Router } from "express";
import { lookup } from "node:dns/promises";

const router = Router();

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:)/i;

const RSS_ALLOWLIST = new Set([
  "g1.globo.com", "feeds.bbci.co.uk", "rss.uol.com.br",
  "cnnbrasil.com.br", "agenciabrasil.ebc.com.br", "www.correiobraziliense.com.br",
  "feeds.folha.uol.com.br", "rss.nytimes.com", "feeds.reuters.com",
  "rss.cnn.com", "feeds.feedburner.com", "news.google.com",
]);

async function isPrivateHost(urlStr: string): Promise<boolean> {
  try {
    const { hostname } = new URL(urlStr);
    const { address } = await lookup(hostname, { family: 4 });
    return PRIVATE_IP_RE.test(address);
  } catch {
    return true; // block if unresolvable
  }
}

function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? cleanText(m[1]) : "";
}

// GET /api/rss-proxy?url=<encoded>
// Retorna { feedTitle, items: [{title, description}] }
router.get("/rss-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: "url param required" });
    return;
  }

  // Validate URL structure
  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch {
    res.status(400).json({ error: "url inválida" }); return;
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    res.status(400).json({ error: "Protocolo não permitido" }); return;
  }

  const isAuthed = req.isAuthenticated?.();
  if (!isAuthed) {
    // Unauthenticated: only allow known allowlist hostnames
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    const hostnameWithWww = parsedUrl.hostname.toLowerCase();
    if (!RSS_ALLOWLIST.has(hostname) && !RSS_ALLOWLIST.has(hostnameWithWww)) {
      res.status(403).json({ error: "Host não permitido sem autenticação" }); return;
    }
  }

  // SSRF: always block private/loopback IPs after DNS resolve
  if (await isPrivateHost(url)) {
    res.status(403).json({ error: "Host não permitido" }); return;
  }

  try {
    const cacheBuster = url.includes("?") ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
    const response = await fetch(`${url}${cacheBuster}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RPShow/1.0; RSS Reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `upstream ${response.status}` });
      return;
    }

    // Block oversized responses (> 2 MB)
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 2_097_152) {
      res.status(413).json({ error: "Feed muito grande" }); return;
    }
    const xml = await response.text();
    if (xml.length > 2_097_152) {
      res.status(413).json({ error: "Feed muito grande" }); return;
    }

    // ── Extrai título do canal/feed ────────────────────────────────────────
    let feedTitle = "";
    // RSS 2.0: <channel><title>
    const channelBlock = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? xml;
    feedTitle = extractTag(channelBlock.replace(/<item[\s\S]*$/i, ""), "title");
    // Atom: <feed><title>
    if (!feedTitle) {
      const feedBlock = xml.match(/<feed[^>]*>([\s\S]*?)<\/feed>/i)?.[1] ?? "";
      feedTitle = extractTag(feedBlock.replace(/<entry[\s\S]*$/i, ""), "title");
    }
    // Fallback: domínio da URL
    if (!feedTitle) {
      try { feedTitle = new URL(url).hostname.replace(/^www\./, ""); } catch { feedTitle = "RSS"; }
    }

    const items: { title: string; description: string }[] = [];

    // ── RSS 2.0: blocos <item> ─────────────────────────────────────────────
    const rssItemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = rssItemRegex.exec(xml)) !== null && items.length < 40) {
      const block = match[1];
      const title = extractTag(block, "title");
      const description =
        extractTag(block, "description") ||
        extractTag(block, "content:encoded") ||
        extractTag(block, "summary");
      if (title && title.length > 3) {
        items.push({ title, description: description.slice(0, 400) });
      }
    }

    // ── Atom: blocos <entry> ───────────────────────────────────────────────
    if (items.length === 0) {
      const atomEntryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = atomEntryRegex.exec(xml)) !== null && items.length < 40) {
        const block = match[1];
        const title = extractTag(block, "title");
        const description =
          extractTag(block, "summary") ||
          extractTag(block, "content") ||
          extractTag(block, "media:description");
        if (title && title.length > 3) {
          items.push({ title, description: description.slice(0, 400) });
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ feedTitle, items });
  } catch (err) {
    req.log.warn({ err, url }, "RSS proxy fetch failed");
    res.status(502).json({ error: "fetch failed" });
  }
});

export default router;
