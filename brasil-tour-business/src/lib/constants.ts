// ---------------------------------------------------------------------------
// Dados de contato — troque aqui quando o cliente enviar as informações reais.
// ---------------------------------------------------------------------------

/** Número de WhatsApp em formato internacional, sem símbolos (ex.: 5521999999999). */
export const WHATSAPP_NUMBER = "55XXXXXXXXXXX";

export const CONTACT_EMAIL = "contato@brasiltourbusiness.com.br";

export const INSTAGRAM_HANDLE = "@brasiltourbusiness";
export const INSTAGRAM_URL = "https://instagram.com/brasiltourbusiness";

/** CNPJ pendente — o cliente ainda vai enviar o número oficial. */
export const CNPJ_PLACEHOLDER = "00.000.000/0001-00 (pendente)";

export const BRAND_NAME = "Brasil Tour & Business";
export const BRAND_TAGLINE = "Opening Doors Beyond Travel";

export function buildWhatsAppLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}
