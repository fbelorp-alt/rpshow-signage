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
      `ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS transition_type TEXT NOT NULL DEFAULT 'cut'`,
      // screens — colunas de CNPJ/empresa adicionadas para identificação do local
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS cnpj TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS company_name TEXT`,
      // subscription_payments — garante que a tabela existe e tem todas as colunas
      `CREATE TABLE IF NOT EXISTS subscription_payments (
        id SERIAL PRIMARY KEY,
        operator_id INTEGER NOT NULL,
        screen_id INTEGER REFERENCES screens(id) ON DELETE SET NULL,
        reference_month TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        amount TEXT NOT NULL DEFAULT '80.00',
        notes TEXT,
        paid_at TIMESTAMP,
        due_date TIMESTAMP,
        payment_type TEXT,
        boleto_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS payment_type TEXT`,
      `ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS boleto_url TEXT`,
      `ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS screen_id INTEGER REFERENCES screens(id) ON DELETE SET NULL`,
      `ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP`,
      // screens — velocidade de rede medida pelo player
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS network_speed_mbps REAL`,
      // screens — colunas adicionadas após deploy inicial
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_token TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_on_time TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_off_time TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_width INTEGER`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_height INTEGER`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_rotation INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS online_since TIMESTAMP`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS price TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS target_brightness INTEGER`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_schedule_json TEXT`,
      `ALTER TABLE screens ADD COLUMN IF NOT EXISTS last_screenshot TEXT`,
      // operators — colunas de identificação/hierarquia
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS cnpj TEXT`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS company_name TEXT`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS parent_operator_id INTEGER REFERENCES operators(id)`,
      `ALTER TABLE operators ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix'`,
      // screen_speed_logs — histórico de velocidade de rede por tela
      `CREATE TABLE IF NOT EXISTS screen_speed_logs (
        id SERIAL PRIMARY KEY,
        screen_id INTEGER NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
        speed_mbps REAL NOT NULL,
        recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
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
