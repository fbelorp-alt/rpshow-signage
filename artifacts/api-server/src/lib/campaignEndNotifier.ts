import { db, schedulesTable, screensTable, mediaPlaysTable, usersTable } from "@workspace/db";
import { and, eq, isNull, lte, gte, inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendCampaignEndReport } from "./email";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min

async function checkExpiredCampaigns() {
  try {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Find schedules that expired recently and haven't been notified yet
    // endAt stored as midnight UTC → add 24h to treat as end-of-day
    const expired = await db
      .select({
        id: schedulesTable.id,
        name: schedulesTable.name,
        clientName: schedulesTable.clientName,
        campaignGroupId: schedulesTable.campaignGroupId,
        screenId: schedulesTable.screenId,
        playlistId: schedulesTable.playlistId,
        startAt: schedulesTable.startAt,
        endAt: schedulesTable.endAt,
      })
      .from(schedulesTable)
      .where(
        and(
          isNull(schedulesTable.endNotifiedAt),
          sql`${schedulesTable.endAt} IS NOT NULL`,
          // endAt + 24h < now (fully expired)
          sql`${schedulesTable.endAt} + interval '24 hours' < ${now}`,
          // but not too old (avoid spamming ancient campaigns)
          sql`${schedulesTable.endAt} > ${twoDaysAgo}`,
        )
      );

    if (expired.length === 0) return;

    // Group by campaignGroupId (or individual id when no group)
    const groups = new Map<string, typeof expired>();
    for (const s of expired) {
      const key = s.campaignGroupId ?? `solo_${s.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    for (const [, schedules] of groups) {
      try {
        const first = schedules[0];

        // Get all screen names for this group
        const screenIds = schedules.map(s => s.screenId);
        const screenRows = await db
          .select({ id: screensTable.id, name: screensTable.name, userId: screensTable.userId })
          .from(screensTable)
          .where(inArray(screensTable.id, screenIds));

        // Get total play count for this campaign
        const playRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(mediaPlaysTable)
          .where(
            and(
              first.campaignGroupId
                ? eq(mediaPlaysTable.campaignGroupId, first.campaignGroupId)
                : eq(mediaPlaysTable.screenId, first.screenId),
              first.startAt ? gte(mediaPlaysTable.playedAt, first.startAt) : undefined,
            )
          );
        const totalPlays = Number(playRows[0]?.count ?? 0);

        // Get operator email via userId from any screen in this group
        const userId = screenRows.find(s => s.userId)?.userId;
        let toEmail: string | null = null;
        if (userId) {
          const [userRow] = await db
            .select({ email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, userId));
          toEmail = userRow?.email ?? null;
        }

        if (toEmail) {
          await sendCampaignEndReport({
            to: toEmail,
            campaignName: first.name ?? "Campanha",
            clientName: first.clientName ?? null,
            startAt: first.startAt,
            endAt: first.endAt,
            screens: screenRows.map(s => s.name ?? `Tela #${s.id}`),
            totalPlays,
          });
          logger.info({ campaignName: first.name, toEmail, totalPlays }, "Relatório de término de campanha enviado");
        }

        // Mark all schedules in this group as notified
        const ids = schedules.map(s => s.id);
        await db
          .update(schedulesTable)
          .set({ endNotifiedAt: now })
          .where(inArray(schedulesTable.id, ids));

      } catch (err) {
        logger.error({ err, scheduleName: schedules[0].name }, "Erro ao processar notificação de término de campanha");
      }
    }
  } catch (err) {
    logger.error({ err }, "Erro no verificador de campanhas expiradas");
  }
}

export function startCampaignEndNotifier() {
  logger.info("Notificador de término de campanhas iniciado (verificação a cada 30 min)");
  setInterval(checkExpiredCampaigns, CHECK_INTERVAL_MS);
  checkExpiredCampaigns();
}
