/*
  # Add test_fee to line_type constraint

  ## Summary
  Updates the CHECK constraint on `weekly_invoice_line_items.line_type` to
  include 'test_fee' as a valid value. This is needed for the lab-test-based
  invoicing where each line item represents a test method with a per-test rate.

  ## Changes
  - Drops the existing constraint `weekly_invoice_line_items_line_type_check`
  - Recreates it with the added 'test_fee' value
*/

ALTER TABLE weekly_invoice_line_items
  DROP CONSTRAINT IF EXISTS weekly_invoice_line_items_line_type_check;

ALTER TABLE weekly_invoice_line_items
  ADD CONSTRAINT weekly_invoice_line_items_line_type_check
  CHECK (line_type IN ('service_fee', 'lis_saas_fee', 'custom', 'test_fee'));
