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

/** Normaliza label de charset para um encoding aceito por TextDecoder. */
function normalizeCharset(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const c = raw.trim().toLowerCase().replace(/['"]/g, "");
  if (!c) return null;
  if (c === "utf8" || c === "utf-8" || c === "unicode-1-1-utf-8") return "utf-8";
  if (
    c === "iso-8859-1" ||
    c === "iso8859-1" ||
    c === "latin1" ||
    c === "latin-1" ||
    c === "windows-1252" ||
    c === "cp1252" ||
    c === "us-ascii" ||
    c === "ascii"
  ) {
    // windows-1252 cobre ISO-8859-1 + aspas tipográficas comuns em feeds BR
    return "windows-1252";
  }
  if (c === "iso-8859-15" || c === "latin9") return "iso-8859-15";
  return c;
}

function charsetFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  const m = ct.match(/charset\s*=\s*["']?([^"';\s]+)/i);
  return normalizeCharset(m?.[1]);
}

function charsetFromXmlDeclaration(bytes: Uint8Array): string | null {
  // Declaração XML fica no começo; lê só o prefixo em latin1 (ASCII-safe).
  const head = new TextDecoder("windows-1252").decode(bytes.subarray(0, Math.min(bytes.length, 512)));
  const m = head.match(/<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i);
  return normalizeCharset(m?.[1]);
}

function countReplacementChars(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
  return n;
}

function decodeWith(label: string, bytes: Uint8Array): string | null {
  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Decodifica o corpo do feed respeitando Content-Type / encoding= do XML.
 * Feeds BR (ex.: UOL) ainda mandam ISO-8859-1; response.text() força UTF-8 e
 * vira U+FFFD (�) nos acentos.
 */
function decodeRssBody(bytes: Uint8Array, contentType: string | null): string {
  const declared =
    charsetFromContentType(contentType) ||
    charsetFromXmlDeclaration(bytes) ||
    null;

  if (declared) {
    const primary = decodeWith(declared, bytes);
    if (primary != null) {
      // Se o header mentiu e veio UTF-8 real, preferir UTF-8 quando tiver bem menos �
      if (declared !== "utf-8") {
        const asUtf8 = decodeWith("utf-8", bytes);
        if (asUtf8 != null) {
          const badPrimary = countReplacementChars(primary);
          const badUtf8 = countReplacementChars(asUtf8);
          if (badUtf8 + 2 < badPrimary) return asUtf8;
        }
      }
      return primary;
    }
  }

  const utf8 = decodeWith("utf-8", bytes) ?? "";
  const latin = decodeWith("windows-1252", bytes) ?? utf8;
  const badUtf8 = countReplacementChars(utf8);
  const badLatin = countReplacementChars(latin);
  // Heurística: muitos � em UTF-8 ⇒ provavelmente latin1/windows-1252
  if (badUtf8 > 0 && badUtf8 >= badLatin + 2) return latin;
  return utf8;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const cp = parseInt(hex, 16);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(cp);
      } catch {
        return " ";
      }
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const cp = parseInt(dec, 10);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(cp);
      } catch {
        return " ";
      }
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&acirc;/gi, "â")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&agrave;/gi, "à")
    .replace(/&uuml;/gi, "ü")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»");
}

function cleanText(s: string): string {
  return decodeHtmlEntities(
    s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " "),
  )
    // Remove replacement chars e controles (mantém \n/\t limpos via espaço)
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
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

  // Aceita: sessão web (isAuthenticated) OU device token do player (X-Device-Token / Bearer / ?token)
  const hasDeviceToken = !!(
    req.headers["x-device-token"] ||
    (req.headers.authorization?.startsWith("Bearer ") && req.headers.authorization.slice(7)) ||
    req.query["token"]
  );
  const isAuthed = req.isAuthenticated?.() || hasDeviceToken;
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

    const buf = new Uint8Array(await response.arrayBuffer());
    if (buf.byteLength > 2_097_152) {
      res.status(413).json({ error: "Feed muito grande" }); return;
    }

    const xml = decodeRssBody(buf, response.headers.get("content-type"));

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
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json({ feedTitle, items });
  } catch (err) {
    req.log.warn({ err, url }, "RSS proxy fetch failed");
    res.status(502).json({ error: "fetch failed" });
  }
});

export default router;
