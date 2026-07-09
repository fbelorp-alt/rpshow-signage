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

// GET /api/rss-proxy?url=<encoded>
// Busca e parseia um feed RSS, retorna array de {title, description}.
// Roda no servidor para evitar CORS e cache do Android.
router.get("/rss-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: "url param required" });
    return;
  }

  try {
    // Cache-buster garante que o servidor sempre busca versão fresca
    const cacheBuster = url.includes("?") ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
    const response = await fetch(`${url}${cacheBuster}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RPShow/1.0; RSS Reader)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `upstream ${response.status}` });
      return;
    }

    const xml = await response.text();

    // Extrai blocos <item>...</item>
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    const items: { title: string; description: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
      const block = match[1];

      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const descMatch  = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i);

      const title       = titleMatch ? cleanText(titleMatch[1]) : "";
      const description = descMatch  ? cleanText(descMatch[1]).slice(0, 400) : "";

      if (title && title.length > 3) {
        items.push({ title, description });
      }
    }

    // Cache de 5 minutos no servidor — suficiente para não sobrecarregar o feed
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(items);
  } catch (err) {
    req.log.warn({ err, url }, "RSS proxy fetch failed");
    res.status(502).json({ error: "fetch failed" });
  }
});

export default router;
