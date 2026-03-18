
/*
  # Fix Upsert Constraints

  ## Problems Fixed

  1. qbo_invoices natural key fails when num or product_service is NULL
     (NULL != NULL in SQL, so UNIQUE constraints on nullable columns don't catch duplicates for upsert)
     Solution: Set empty-string defaults and add NOT NULL, then rebuild the constraint.

  2. commission_calculations has no UNIQUE constraint on (invoice_id, sales_rep_id)
     but the service calls upsert with onConflict: 'invoice_id,sales_rep_id'
     Solution: Add the missing unique constraint.

  3. qbo_invoices status check constraint rejects values like 'Invoice' from QB
     Solution: Drop and recreate with a broader allowed set.
*/

-- 1. Fix nullable columns in qbo_invoices natural key
-- Set empty string defaults so NULLs don't break uniqueness

UPDATE qbo_invoices SET num = '' WHERE num IS NULL;
UPDATE qbo_invoices SET product_service = '' WHERE product_service IS NULL;

ALTER TABLE qbo_invoices
  ALTER COLUMN num SET DEFAULT '',
  ALTER COLUMN num SET NOT NULL,
  ALTER COLUMN product_service SET DEFAULT '',
  ALTER COLUMN product_service SET NOT NULL;

-- Drop and recreate the constraint (now on NOT NULL columns)
ALTER TABLE qbo_invoices DROP CONSTRAINT IF EXISTS qbo_invoices_natural_key;
ALTER TABLE qbo_invoices
  ADD CONSTRAINT qbo_invoices_natural_key
  UNIQUE (transaction_date, num, customer_name, product_service);

-- 2. Add missing unique constraint on commission_calculations
ALTER TABLE commission_calculations
  DROP CONSTRAINT IF EXISTS commission_calculations_invoice_rep_unique;

ALTER TABLE commission_calculations
  ADD CONSTRAINT commission_calculations_invoice_rep_unique
  UNIQUE (invoice_id, sales_rep_id);

-- 3. Broaden qbo_invoices status check to include all QB transaction types
ALTER TABLE qbo_invoices DROP CONSTRAINT IF EXISTS qbo_invoices_status_check;
ALTER TABLE qbo_invoices
  ADD CONSTRAINT qbo_invoices_status_check
  CHECK (status = ANY (ARRAY[
    'Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Voided', 'Invoice', 'Credit Memo', 'Payment'
  ]));
