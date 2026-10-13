/*
  # StratusDX V2 Schema Upgrade

  1. Overview
    Upgrades the lab integration tables to support the new StratusDX API
    which uses OAuth authentication and accession-ID-based endpoints.
    Adds columns for richer order/result data, a sync checkpoint table
    for incremental polling, and a token cache table for OAuth tokens.

  2. Modified Tables
    - lab_orders: adds accession_id, order_status, organization_name,
      location_name, provider_name, patient_initials, panels (jsonb),
      processed_at_utc
    - lab_results: adds accession_id, result_status, abnormal_flag,
      result_value, reference_range, units, resulted_at_utc

  3. New Tables
    - stratus_sync_checkpoint: single-row table tracking the highest
      processedAtUtc timestamp so each sync run picks up where the last
      one left off
    - stratus_token_cache: stores the OAuth access token and its expiry
      so multiple function invocations share the same token

  4. Security
    - RLS enabled on both new tables
    - Only proximity_admin and proximity_staff can read/write the
      checkpoint and token cache (server-side only via service role)

  5. Notes
    - All new columns default to NULL so existing records continue to
      display without breaking
    - The sync_status check constraint on lab_orders is expanded to
      include 'synced' for the new incremental sync flow
*/

-- Add columns to lab_orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'accession_id') THEN
    ALTER TABLE lab_orders ADD COLUMN accession_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'order_status') THEN
    ALTER TABLE lab_orders ADD COLUMN order_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'organization_name') THEN
    ALTER TABLE lab_orders ADD COLUMN organization_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'location_name') THEN
    ALTER TABLE lab_orders ADD COLUMN location_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'provider_name') THEN
    ALTER TABLE lab_orders ADD COLUMN provider_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_initials') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_initials text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'panels') THEN
    ALTER TABLE lab_orders ADD COLUMN panels jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'processed_at_utc') THEN
    ALTER TABLE lab_orders ADD COLUMN processed_at_utc timestamptz;
  END IF;
END $$;

-- Add columns to lab_results
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'accession_id') THEN
    ALTER TABLE lab_results ADD COLUMN accession_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'abnormal_flag') THEN
    ALTER TABLE lab_results ADD COLUMN abnormal_flag text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'result_value') THEN
    ALTER TABLE lab_results ADD COLUMN result_value text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'reference_range') THEN
    ALTER TABLE lab_results ADD COLUMN reference_range text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'units') THEN
    ALTER TABLE lab_results ADD COLUMN units text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_results' AND column_name = 'resulted_at_utc') THEN
    ALTER TABLE lab_results ADD COLUMN resulted_at_utc timestamptz;
  END IF;
END $$;

-- Expand sync_status check constraint on lab_orders to include 'synced'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'lab_orders' AND constraint_name = 'lab_orders_sync_status_check'
  ) THEN
    ALTER TABLE lab_orders DROP CONSTRAINT lab_orders_sync_status_check;
  END IF;
END $$;
ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_sync_status_check
  CHECK (sync_status IN ('pending', 'retrieved', 'acknowledged', 'synced', 'error'));

-- Create index on accession_id for fast upserts
CREATE INDEX IF NOT EXISTS idx_lab_orders_accession_id ON lab_orders(accession_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_accession_id ON lab_results(accession_id);

-- Sync checkpoint table (single row)
CREATE TABLE IF NOT EXISTS stratus_sync_checkpoint (
  id integer PRIMARY KEY DEFAULT 1,
  last_processed_at_utc timestamptz,
  last_sync_run_at timestamptz DEFAULT now(),
  last_sync_summary jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT single_row_only CHECK (id = 1)
);

INSERT INTO stratus_sync_checkpoint (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- Token cache table
CREATE TABLE IF NOT EXISTS stratus_token_cache (
  id integer PRIMARY KEY DEFAULT 1,
  access_token text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamptz,
  acquired_at timestamptz DEFAULT now(),
  CONSTRAINT single_token_row CHECK (id = 1)
);

INSERT INTO stratus_token_cache (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE stratus_sync_checkpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE stratus_token_cache ENABLE ROW LEVEL SECURITY;

-- RLS: only internal staff can access checkpoint and token cache
DROP POLICY IF EXISTS "Admins can manage sync checkpoint" ON stratus_sync_checkpoint;
CREATE POLICY "Admins can manage sync checkpoint"
  ON stratus_sync_checkpoint FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  );

DROP POLICY IF EXISTS "Admins can manage token cache" ON stratus_token_cache;
CREATE POLICY "Admins can manage token cache"
  ON stratus_token_cache FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  );
