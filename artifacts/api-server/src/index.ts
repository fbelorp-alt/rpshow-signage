import app from "./app";
import { logger } from "./lib/logger";
import { startOfflineMonitor } from "./lib/offlineMonitor";
import { startCampaignEndNotifier } from "./lib/campaignEndNotifier";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function runSafeMigrations() {
  try {
    // Colunas adicionadas após o deploy inicial — seguro reexecutar (IF NOT EXISTS)
    const migrations = [
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS object_fit TEXT NOT NULL DEFAULT 'contain'`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS photo_url TEXT`,
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS title TEXT`,
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS client_name TEXT`,
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS start_at TIMESTAMP`,
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS end_at TIMESTAMP`,
    ];
    for (const stmt of migrations) {
      await db.execute(sql.raw(stmt));
    }
    logger.info("Safe migrations applied");
  } catch (err) {
    logger.warn({ err }, "Safe migrations warning (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  runSafeMigrations();
  startOfflineMonitor();
  startCampaignEndNotifier();
});
