-- VPS Migration: add all columns that may be missing from operators table
-- Safe to run multiple times (IF NOT EXISTS)

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

-- screens: device_token (for player auth)
ALTER TABLE screens ADD COLUMN IF NOT EXISTS device_token text;
CREATE UNIQUE INDEX IF NOT EXISTS screens_device_token_uidx ON screens(device_token) WHERE device_token IS NOT NULL;

-- screens: other potentially missing columns
ALTER TABLE screens ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_width integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_height integer;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS panel_rotation integer NOT NULL DEFAULT 0;
ALTER TABLE screens ADD COLUMN IF NOT EXISTS target_brightness integer;

-- playlist_items: potentially missing columns
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS start_at timestamp;
ALTER TABLE playlist_items ADD COLUMN IF NOT EXISTS end_at timestamp;

-- trusted_devices table (for TOTP 2FA)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id serial PRIMARY KEY,
  operator_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS trusted_devices_operator_hash_uidx ON trusted_devices(operator_id, device_hash);

-- password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  operator_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

-- subscription_payments table
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

-- screen_groups table
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

-- emergency_alerts table
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id serial PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  user_id integer NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp
);

-- media_plays table (play tracking)
CREATE TABLE IF NOT EXISTS media_plays (
  id serial PRIMARY KEY,
  screen_id integer REFERENCES screens(id) ON DELETE SET NULL,
  media_id integer REFERENCES media(id) ON DELETE SET NULL,
  playlist_id integer REFERENCES playlists(id) ON DELETE SET NULL,
  played_at timestamp NOT NULL DEFAULT now(),
  duration_seconds integer,
  campaign_group_id text,
  client_name text
);
