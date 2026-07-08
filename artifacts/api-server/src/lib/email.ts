import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

// Integration: Resend (connector "resend") — sends transactional email via the
// Replit connector proxy. Auth is handled automatically by the SDK.
const connectors = new ReplitConnectors();

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  try {
    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: {
        from: `RPShow OnSign <${FROM_EMAIL}>`,
        to: [to],
        subject: "Recuperação de senha — RPShow OnSign",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #111;">Recuperação de senha</h2>
            <p style="color: #333;">Recebemos uma solicitação para redefinir sua senha na plataforma RPShow OnSign.</p>
            <p style="color: #333;">Clique no botão abaixo para criar uma nova senha. Este link expira em 1 hora.</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Redefinir senha
              </a>
            </p>
            <p style="color: #888; font-size: 12px;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
          </div>
        `,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, body }, "Falha ao enviar e-mail de recuperação de senha via Resend");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Erro ao enviar e-mail de recuperação de senha");
    return false;
  }
}
