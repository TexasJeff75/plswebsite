/*
  # Create Weekly Invoice Calculation System

  ## Summary
  Creates a new section of the deployment portal for weekly client invoicing.
  Admins select a requisition date, the system calculates the billing week
  (Sunday–Saturday), and generates one invoice per organization with line items
  per billable facility. Invoices can be reviewed, edited, and exported to a
  QuickBooks-compatible CSV for rapid import.

  ## New Tables

  1. `weekly_invoice_batches`
     - Represents one invoice-generation run for a given week.
     - `batch_number` — auto-generated unique identifier (WB-YYYYMMDD-xxxxxx).
     - `requisition_date` — the date the admin selects as the basis for billing.
     - `week_start` / `week_end` — the calculated Sunday-to-Saturday billing window.
     - `status` — draft → reviewed → exported → void.
     - `total_amount` — sum of all invoice totals in the batch.
     - `invoice_count` / `facility_count` — summary counters.
     - `created_by` — the admin who generated the batch.
     - `exported_at` — timestamp when the batch was exported to QuickBooks CSV.

  2. `weekly_invoices`
     - One invoice per organization per batch.
     - `batch_id` — FK to weekly_invoice_batches (CASCADE on delete).
     - `organization_id` — FK to organizations (RESTRICT to preserve billing history).
     - `invoice_number` — auto-generated, format: <ORG_CODE>-<MMDDYY>.
     - `qb_customer_name` — the customer name as it should appear in QuickBooks.
     - `total_amount` — sum of all line item amounts.
     - `status` — draft → reviewed → exported → void.
     - Unique constraint on (batch_id, organization_id) prevents duplicate invoices.

  3. `weekly_invoice_line_items`
     - One line per facility per invoice (service fee, LIS SaaS fee, or custom).
     - `invoice_id` — FK to weekly_invoices (CASCADE on delete).
     - `facility_id` — FK to facilities (SET NULL so historical invoices survive facility deletion).
     - `facility_name` — denormalized for historical record.
     - `line_type` — service_fee | lis_saas_fee | custom.
     - `description` — human-readable line description.
     - `quantity` — defaults to 1 (weekly billing = 1 week).
     - `unit_price` — the weekly rate (monthly fee ÷ 4.345).
     - `amount` — quantity × unit_price.

  ## Security
  - RLS enabled on all three tables.
  - Access restricted to Super Admin and Proximity Admin roles (matching the
    existing commissions access pattern for financial data).

  ## Notes
  1. Weekly rates are calculated as monthly_fee ÷ 4.345 (average weeks per month)
     to ensure annual billing matches the monthly contract value.
  2. Only facilities with `service_fee_start_date` on or before the requisition
     date are included in invoice generation.
  3. Facilities with `site_configuration = 'waived'` are included but the
     admin can remove them during review.
*/

-- ============================================================
-- weekly_invoice_batches
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_invoice_batches (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number     text UNIQUE NOT NULL DEFAULT 'WB-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6),
  requisition_date date NOT NULL,
  week_start       date NOT NULL,
  week_end         date NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'reviewed', 'exported', 'void')),
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  invoice_count    integer NOT NULL DEFAULT 0,
  facility_count   integer NOT NULL DEFAULT 0,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  exported_at      timestamptz,
  notes            text DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weekly_invoice_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view invoice batches" ON weekly_invoice_batches;
CREATE POLICY "Admin can view invoice batches"
  ON weekly_invoice_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can insert invoice batches" ON weekly_invoice_batches;
CREATE POLICY "Admin can insert invoice batches"
  ON weekly_invoice_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update invoice batches" ON weekly_invoice_batches;
CREATE POLICY "Admin can update invoice batches"
  ON weekly_invoice_batches FOR UPDATE
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

DROP POLICY IF EXISTS "Admin can delete invoice batches" ON weekly_invoice_batches;
CREATE POLICY "Admin can delete invoice batches"
  ON weekly_invoice_batches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

-- ============================================================
-- weekly_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id         uuid NOT NULL REFERENCES weekly_invoice_batches(id) ON DELETE CASCADE,
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  invoice_number   text NOT NULL,
  requisition_date date NOT NULL,
  week_start       date NOT NULL,
  week_end         date NOT NULL,
  total_amount     numeric(12,2) NOT NULL DEFAULT 0,
  line_count       integer NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'reviewed', 'exported', 'void')),
  qb_customer_name text,
  notes            text DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weekly_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view weekly invoices" ON weekly_invoices;
CREATE POLICY "Admin can view weekly invoices"
  ON weekly_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can insert weekly invoices" ON weekly_invoices;
CREATE POLICY "Admin can insert weekly invoices"
  ON weekly_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update weekly invoices" ON weekly_invoices;
CREATE POLICY "Admin can update weekly invoices"
  ON weekly_invoices FOR UPDATE
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

DROP POLICY IF EXISTS "Admin can delete weekly invoices" ON weekly_invoices;
CREATE POLICY "Admin can delete weekly invoices"
  ON weekly_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

-- ============================================================
-- weekly_invoice_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_invoice_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES weekly_invoices(id) ON DELETE CASCADE,
  facility_id  uuid REFERENCES facilities(id) ON DELETE SET NULL,
  facility_name text NOT NULL,
  line_type    text NOT NULL DEFAULT 'service_fee'
               CHECK (line_type IN ('service_fee', 'lis_saas_fee', 'custom')),
  description  text DEFAULT '',
  quantity     numeric(12,4) NOT NULL DEFAULT 1,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weekly_invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view invoice line items" ON weekly_invoice_line_items;
CREATE POLICY "Admin can view invoice line items"
  ON weekly_invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can insert invoice line items" ON weekly_invoice_line_items;
CREATE POLICY "Admin can insert invoice line items"
  ON weekly_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

DROP POLICY IF EXISTS "Admin can update invoice line items" ON weekly_invoice_line_items;
CREATE POLICY "Admin can update invoice line items"
  ON weekly_invoice_line_items FOR UPDATE
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

DROP POLICY IF EXISTS "Admin can delete invoice line items" ON weekly_invoice_line_items;
CREATE POLICY "Admin can delete invoice line items"
  ON weekly_invoice_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Super Admin', 'Proximity Admin')
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_weekly_invoice_batches_status ON weekly_invoice_batches(status);
CREATE INDEX IF NOT EXISTS idx_weekly_invoice_batches_requisition_date ON weekly_invoice_batches(requisition_date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_invoices_batch_id ON weekly_invoices(batch_id);
CREATE INDEX IF NOT EXISTS idx_weekly_invoices_organization_id ON weekly_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_invoices_status ON weekly_invoices(status);
CREATE INDEX IF NOT EXISTS idx_weekly_invoice_line_items_invoice_id ON weekly_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_weekly_invoice_line_items_facility_id ON weekly_invoice_line_items(facility_id);

-- Unique constraint: one invoice per org per batch
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_invoices_batch_id_organization_id_key'
  ) THEN
    ALTER TABLE weekly_invoices ADD CONSTRAINT weekly_invoices_batch_id_organization_id_key UNIQUE (batch_id, organization_id);
  END IF;
END $$;
