import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

// Integration: Resend (connector "resend") — sends transactional email via the
// Replit connector proxy. Auth is handled automatically by the SDK.
const connectors = new ReplitConnectors();

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export interface CampaignEndReportParams {
  to: string;
  campaignName: string;
  clientName: string | null;
  startAt: Date | null | undefined;
  endAt: Date | null | undefined;
  screens: string[];
  totalPlays: number;
}

export async function sendCampaignEndReport(params: CampaignEndReportParams): Promise<boolean> {
  const { to, campaignName, clientName, startAt, endAt, screens, totalPlays } = params;
  const fmt = (d?: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  const screenList = screens.map(s => `<li style="padding:2px 0;color:#334155;">${s}</li>`).join("");
  try {
    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: {
        from: `RPShow OnSign <${FROM_EMAIL}>`,
        to: [to],
        subject: `✅ Campanha encerrada: ${campaignName}`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
            <div style="background:#0f1117;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.15em;color:#79B4B0;text-transform:uppercase;">RPShow OnSign</p>
              <h1 style="margin:8px 0 0;font-size:22px;color:#fff;font-weight:700;">Relatório de Campanha</h1>
            </div>
            <div style="padding:32px;">
              <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;width:40%">Campanha</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f1117;font-weight:700;">${campaignName}</td></tr>
                ${clientName ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Cliente</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">${clientName}</td></tr>` : ""}
                <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Período</td>
                    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">${fmt(startAt)} → ${fmt(endAt)}</td></tr>
                <tr><td style="padding:8px 0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Total de plays</td>
                    <td style="padding:8px 0;font-size:22px;color:#79B4B0;font-weight:800;">${totalPlays.toLocaleString("pt-BR")}</td></tr>
              </table>
              <div style="margin-bottom:24px;">
                <p style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Telas exibidas</p>
                <ul style="margin:0;padding:0 0 0 20px;">${screenList}</ul>
              </div>
              <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">Relatório gerado automaticamente pela plataforma RPShow OnSign.</p>
            </div>
          </div>
        `,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, body }, "Falha ao enviar relatório de término de campanha");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Erro ao enviar relatório de término de campanha");
    return false;
  }
}

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
