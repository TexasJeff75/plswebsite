/*
  # Add Test Method Rate Table for Lab-Based Invoicing

  ## Summary
  The weekly invoicing system has been pivoted from facility-fee-based billing
  to lab-test-count-based billing. Admins upload a lab data export (Excel)
  containing individual test records with Test Method and Requisition Date
  columns. The system groups tests by week, counts tests per method, and
  multiplies by per-method rates to produce invoice line items.

  This migration adds:
  1. A `test_method_rates` table for configurable per-test pricing.
  2. New columns on `weekly_invoice_line_items` to store test counts and
     the source file name.

  ## New Table: `test_method_rates`
  - `id` — uuid PK.
  - `test_method` — the test method name as it appears in the data file
    (e.g., "AMA Screens", "AMMO Blood", "HS360 Blood"). Unique.
  - `rate` — the per-test billing rate in USD.
  - `description` — optional human-readable description.
  - `is_active` — whether the rate is currently in use.
  - `created_at` / `updated_at` — timestamps.

  ## Modified Table: `weekly_invoice_line_items`
  - `test_count` (integer) — number of tests for this line item (for test-based lines).
  - `source_file` (text) — the name of the uploaded file that generated this line.

  ## Security
  - RLS enabled on `test_method_rates`, restricted to Super Admin and Proximity Admin.
  - Existing RLS on `weekly_invoice_line_items` already covers the new columns.

  ## Notes
  1. Seed data includes the test methods observed in the sample files:
     AMA Screens, AMA Confirmation, AMA Saliva, AMA Saliva HS360,
     AMMO Blood, HS360 Blood, and the combined "AMA Confirmation, AMA Screens"
     and "AMMO Blood, HS360 Blood" methods.
  2. Rates default to $0.00 — the admin must set actual rates before generating invoices.
*/

-- ============================================================
-- test_method_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS test_method_rates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_method text UNIQUE NOT NULL,
  rate        numeric(12,2) NOT NULL DEFAULT 0,
  description text DEFAULT '',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE test_method_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view test method rates" ON test_method_rates;
CREATE POLICY "Admin can view test method rates"
  ON test_method_rates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can insert test method rates" ON test_method_rates;
CREATE POLICY "Admin can insert test method rates"
  ON test_method_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update test method rates" ON test_method_rates;
CREATE POLICY "Admin can update test method rates"
  ON test_method_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can delete test method rates" ON test_method_rates;
CREATE POLICY "Admin can delete test method rates"
  ON test_method_rates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

-- ============================================================
-- Add columns to weekly_invoice_line_items
-- ============================================================
ALTER TABLE weekly_invoice_line_items
  ADD COLUMN IF NOT EXISTS test_count integer,
  ADD COLUMN IF NOT EXISTS source_file text DEFAULT '';

-- ============================================================
-- Seed default test method rates (all $0 — admin sets actual rates)
-- ============================================================
INSERT INTO test_method_rates (test_method, rate, description)
VALUES
  ('AMA Screens', 0, 'AMA Screens test'),
  ('AMA Confirmation', 0, 'AMA Confirmation test'),
  ('AMA Confirmation, AMA Screens', 0, 'Combined AMA Confirmation + Screens'),
  ('AMA Saliva', 0, 'AMA Saliva test'),
  ('AMA Saliva HS360', 0, 'AMA Saliva HS360 test'),
  ('AMMO Blood', 0, 'AMMO Blood test'),
  ('AMMO Blood, HS360 Blood', 0, 'Combined AMMO Blood + HS360 Blood'),
  ('HS360 Blood', 0, 'HS360 Blood test')
ON CONFLICT (test_method) DO NOTHING;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_test_method_rates_active ON test_method_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_weekly_invoice_line_items_test_count ON weekly_invoice_line_items(test_count);
