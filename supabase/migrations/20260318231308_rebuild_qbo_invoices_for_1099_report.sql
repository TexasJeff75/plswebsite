
/*
  # Rebuild QBO Invoices for 1099 Sales Rep Report

  ## Summary
  The QB 1099 Sales Rep Report has a specific structure that includes line-item level
  data (one row per Product/Service per invoice). This migration:

  1. Clears all existing invoice data (and dependent tables) so a clean re-import can happen
  2. Drops the old synthetic qbo_invoice_id unique constraint
  3. Adds columns for the new fields: ar_paid, rep_name, product_service, sales_manager_name
  4. Adds a natural unique key: (transaction_date, num, customer_name, product_service)
     so re-importing the same report is idempotent (upsert-safe)
  5. Re-enables RLS (unchanged)

  ## Columns Added
  - `ar_paid` (text) — A/R paid value from QB (e.g. "Paid", "Unpaid")
  - `rep_name` (text) — Raw 1099 Rep Original name from the report
  - `product_service` (text) — Product/Service line item
  - `sales_manager_name` (text) — Sales Manager column value

  ## Upsert Key
  - UNIQUE constraint on (transaction_date, num, customer_name, product_service)
    allows safe re-import without duplicates
*/

-- 1. Clear dependent data first
TRUNCATE commission_report_items CASCADE;
TRUNCATE commission_calculations CASCADE;
TRUNCATE qb_import_batches CASCADE;
TRUNCATE qbo_invoices CASCADE;

-- 2. Drop old synthetic unique constraint on qbo_invoice_id
ALTER TABLE qbo_invoices DROP CONSTRAINT IF EXISTS qbo_invoices_qbo_invoice_id_key;
ALTER TABLE qbo_invoices ALTER COLUMN qbo_invoice_id DROP NOT NULL;

-- 3. Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='ar_paid') THEN
    ALTER TABLE qbo_invoices ADD COLUMN ar_paid text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='rep_name') THEN
    ALTER TABLE qbo_invoices ADD COLUMN rep_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='product_service') THEN
    ALTER TABLE qbo_invoices ADD COLUMN product_service text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='sales_manager_name') THEN
    ALTER TABLE qbo_invoices ADD COLUMN sales_manager_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='transaction_date') THEN
    ALTER TABLE qbo_invoices ADD COLUMN transaction_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='num') THEN
    ALTER TABLE qbo_invoices ADD COLUMN num text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='qbo_invoices' AND column_name='comm_paid') THEN
    ALTER TABLE qbo_invoices ADD COLUMN comm_paid boolean DEFAULT false;
  END IF;
END $$;

-- 4. Add natural unique key for idempotent upserts
ALTER TABLE qbo_invoices
  DROP CONSTRAINT IF EXISTS qbo_invoices_natural_key;

ALTER TABLE qbo_invoices
  ADD CONSTRAINT qbo_invoices_natural_key
  UNIQUE (transaction_date, num, customer_name, product_service);

-- 5. Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_rep_name ON qbo_invoices(rep_name);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_transaction_date ON qbo_invoices(transaction_date);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_num ON qbo_invoices(num);
