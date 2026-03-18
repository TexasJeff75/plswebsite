/*
  # Add QuickBooks Import Batches Table

  ## Summary
  Replaces the N8N webhook-based invoice sync with a manual QuickBooks report upload workflow.
  This migration adds a table to track each CSV/Excel import batch uploaded by admins.

  ## New Tables
  - `qb_import_batches`
    - `id` (uuid, primary key)
    - `filename` (text) — original uploaded filename
    - `imported_by` (uuid, FK to auth.users) — who performed the import
    - `row_count` (int) — number of invoice rows processed
    - `status` (text) — 'Success', 'Partial', 'Failed'
    - `notes` (text, nullable) — any import notes or warnings
    - `created_at` (timestamptz)

  ## Modified Tables
  - `qbo_invoices`
    - Adds `import_batch_id` (uuid, nullable FK to qb_import_batches) — links each invoice to the batch it came from

  ## Security
  - RLS enabled on qb_import_batches
  - Only Proximity Admin and Proximity Staff can insert/select import batches
*/

CREATE TABLE IF NOT EXISTS qb_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL DEFAULT '',
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  row_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Success',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qb_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity staff can view import batches"
  ON qb_import_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity staff can insert import batches"
  ON qb_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qbo_invoices' AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE qbo_invoices ADD COLUMN import_batch_id uuid REFERENCES qb_import_batches(id) ON DELETE SET NULL;
  END IF;
END $$;
