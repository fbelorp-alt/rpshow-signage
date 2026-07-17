import { Router } from "express";

const router = Router();

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

// Extrai conteúdo de uma tag XML (case-insensitive, com atributos)
function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? cleanText(m[1]) : "";
}

// GET /api/rss-proxy?url=<encoded>
// Busca e parseia feed RSS ou Atom, retorna array de {title, description}.
router.get("/rss-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: "url param required" });
    return;
  }

  try {
    // Cache-buster garante conteúdo fresco a cada request
    const cacheBuster = url.includes("?") ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
    const response = await fetch(`${url}${cacheBuster}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RPShow/1.0; RSS Reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `upstream ${response.status}` });
      return;
    }

    const xml = await response.text();

    const items: { title: string; description: string }[] = [];

    // ── RSS 2.0: blocos <item> ─────────────────────────────────────────────
    const rssItemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;
    while ((match = rssItemRegex.exec(xml)) !== null && items.length < 25) {
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

    // ── Atom: blocos <entry> (G1, BBC, etc.) ──────────────────────────────
    if (items.length === 0) {
      const atomEntryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((match = atomEntryRegex.exec(xml)) !== null && items.length < 25) {
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

    // Sem cache no cliente — player precisa de dados frescos a cada fetch
    res.setHeader("Cache-Control", "no-store");
    res.json(items);
  } catch (err) {
    req.log.warn({ err, url }, "RSS proxy fetch failed");
    res.status(502).json({ error: "fetch failed" });
  }
});

export default router;
