/*
  # Fix qbo_invoices unique constraint to include total_amount

  ## Problem
  The existing unique constraint qbo_invoices_natural_key uses:
    (transaction_date, num, customer_name, product_service)

  This incorrectly deduplicates rows where a customer makes two separate payments on the
  same invoice line for the same product but with different amounts (e.g., two partial payments).
  The second row would silently overwrite the first during import.

  ## Changes
  - Drop the old qbo_invoices_natural_key constraint
  - Add a new constraint that includes total_amount so rows with different amounts are treated as distinct

  ## Impact
  - Re-importing files will no longer collapse rows that share date/num/customer/product but differ in amount
  - Existing data is preserved; no rows are deleted
*/

ALTER TABLE qbo_invoices
  DROP CONSTRAINT IF EXISTS qbo_invoices_natural_key;

ALTER TABLE qbo_invoices
  ADD CONSTRAINT qbo_invoices_natural_key
  UNIQUE (transaction_date, num, customer_name, product_service, total_amount);
