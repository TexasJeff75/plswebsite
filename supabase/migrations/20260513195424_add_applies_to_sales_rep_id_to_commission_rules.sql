/*
  # Add applies_to_sales_rep_id to commission_rules

  ## Problem
  Some reps (Gregory James, Robert Castaneda) earn override commissions based on
  invoices belonging to OTHER reps or specific customers — they will never appear
  as the sales_rep on the invoice itself.

  The existing model only supported matching invoices by the payee rep's ID, which
  broke override scenarios entirely.

  ## Changes
  - Adds `applies_to_sales_rep_id` (uuid, nullable FK → sales_reps) to commission_rules
    Meaning: "trigger this rule when an invoice is assigned to THIS rep"
    If NULL, the rule matches invoices from any rep (combined with customer/product filters)
  - `sales_rep_id` continues to mean "who gets paid"
  - `applies_to_sales_rep_id` means "whose invoices trigger the payment"

  ## Examples
  - Gregory James override on PWIK:
      sales_rep_id = Gregory James, applies_to_sales_rep_id = Tyler Ryan,
      applies_to_customer_name = "Pain and Wellness Institute of Kentucky"
  - Robert Castaneda override on AMGA:
      sales_rep_id = Robert Castaneda, applies_to_sales_rep_id = NULL (any rep),
      applies_to_customer_name = "American Medical Georgia"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_rules' AND column_name = 'applies_to_sales_rep_id'
  ) THEN
    ALTER TABLE commission_rules
      ADD COLUMN applies_to_sales_rep_id uuid REFERENCES sales_reps(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_commission_rules_applies_to_sales_rep
  ON commission_rules(applies_to_sales_rep_id);
