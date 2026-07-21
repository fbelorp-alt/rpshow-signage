-- VPS Migration — idempotente (pode rodar múltiplas vezes)
-- Última atualização: 2026-07-21

-- ── operators ──────────────────────────────────────────────────────────────────
ALTER TABLE operators ADD COLUMN IF NOT EXISTS google_id text;
CREATE UNIQUE INDEX IF NOT EXISTS operators_google_id_unique ON operators(google_id) WHERE google_id IS NOT NULL;

ALTER TABLE operators ADD COLUMN IF NOT EXISTS parent_operator_id integer REFERENCES operators(id);
ALTER TABLE operators ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS responsible text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS job_role text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS screen_count text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial';
ALTER TABLE operators ADD COLUMN IF NOT EXISTS trial_ends_at timestamp;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 30;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS monthly_amount text NOT NULL DEFAULT '0.00';
ALTER TABLE operators ADD COLUMN IF NOT EXISTS price_per_screen text NOT NULL DEFAULT '50.00';
ALTER TABLE operators ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS storage_quota_gb integer NOT NULL DEFAULT 5;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix';

-- ── screens ────────────────────────────────────────────────────────────────────
ALTER TABLE screens ADD COLUMN IF NOT EXISTS client_id integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS last_screenshot text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_on_time text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_off_time text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_width integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_height integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_rotation integer NOT NULL DEFAULT 0;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS target_brightness integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS power_schedule_json text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE screens ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS price text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS online_since timestamp;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS network_speed_mbps real;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS group_id integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS screens_device_token_uidx ON screens(device_token) WHERE device_token IS NOT NULL;

-- ── activity ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity (
  id serial PRIMARY KEY,
  user_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_name text NOT NULL,
  entity_id integer,
  screen_id integer,
  playlist_id integer,
  screen_status text,
  details text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── playlist_items ─────────────────────────────────────────────────────────────
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS start_at timestamp;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS end_at timestamp;

-- ── trusted_devices ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trusted_devices (
  id serial PRIMARY KEY,
  operator_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_operator_hash_uidx ON trusted_devices(operator_id, device_hash);

-- ── password_reset_tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  operator_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── subscription_payments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_payments (
  id serial PRIMARY KEY,
  operator_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  amount text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamp,
  due_date timestamp,
  notes text,
  screen_id integer,
  invoice_number text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── screen_groups ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screen_groups (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  user_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screen_group_members (
  screen_id integer NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  group_id integer NOT NULL REFERENCES screen_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (screen_id, group_id)
);

-- ── emergency_alerts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id serial PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  user_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp
);

-- ── media_plays ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_plays (
  id serial PRIMARY KEY,
  user_id text,
  screen_id integer,
  screen_code text NOT NULL DEFAULT '',
  screen_name text NOT NULL DEFAULT '',
  media_id integer,
  media_name text NOT NULL DEFAULT '',
  media_type text NOT NULL DEFAULT '',
  played_at timestamp NOT NULL DEFAULT now(),
  duration_seconds integer,
  campaign_group_id text,
  client_name text,
  playlist_id integer
);
-- Se a tabela já existe com schema antigo, adicionar colunas faltantes:
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS screen_code text NOT NULL DEFAULT '';
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS screen_name text NOT NULL DEFAULT '';
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS media_name text NOT NULL DEFAULT '';
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT '';
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS campaign_group_id text;
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE media_plays ADD COLUMN IF NOT EXISTS playlist_id integer;

-- ── brightness_schedules ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brightness_schedules (
  id serial PRIMARY KEY,
  screen_id integer NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  start_time text NOT NULL,
  end_time text NOT NULL,
  brightness integer NOT NULL,
  days text NOT NULL DEFAULT '0,1,2,3,4,5,6',
  label text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── screen_connections ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screen_connections (
  id serial PRIMARY KEY,
  screen_id integer NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  event text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── screen_speed_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screen_speed_logs (
  id serial PRIMARY KEY,
  screen_id integer NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  mbps real NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ── apk_versions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apk_versions (
  id serial PRIMARY KEY,
  version text NOT NULL,
  url text NOT NULL,
  release_notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
