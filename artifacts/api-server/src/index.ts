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
      `CREATE TABLE IF NOT EXISTS locations (id SERIAL PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, abbreviation TEXT, address TEXT, city TEXT, latitude TEXT, longitude TEXT, image_url TEXT, audience INTEGER, audience_unit TEXT DEFAULT 'pessoas/hora', timezone TEXT DEFAULT 'America/Sao_Paulo', internal_id TEXT, production_type TEXT, description TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW())`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url TEXT`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS audience INTEGER`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS audience_unit TEXT`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS timezone TEXT`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS internal_id TEXT`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS production_type TEXT`,
      `ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT`,
      // operators — colunas de billing/controle adicionadas após deploy inicial
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS trial_days INTEGER NOT NULL DEFAULT 30`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS monthly_amount TEXT NOT NULL DEFAULT '0.00'`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS price_per_screen TEXT NOT NULL DEFAULT '50.00'`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS storage_quota_gb INTEGER NOT NULL DEFAULT 5`,
    ];
    // Cada statement isolado — se um falhar, os outros (ex: operators) ainda rodam
    for (const stmt of migrations) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (err) {
        logger.warn({ err, stmt: stmt.slice(0, 80) }, "Safe migration statement failed");
      }
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

async function main() {
  // Roda migrations ANTES de aceitar request — login não pode subir sem tentar o ALTER
  await runSafeMigrations();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startOfflineMonitor();
    startCampaignEndNotifier();
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
