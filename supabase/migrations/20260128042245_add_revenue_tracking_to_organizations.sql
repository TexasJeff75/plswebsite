/*
  # Add Revenue Tracking to Organizations Table

  ## Summary
  Adds financial and revenue tracking fields to organizations table to support
  client management and financial reporting capabilities.

  ## Changes

  1. New Fields Added:
    - `monthly_recurring_revenue` (numeric) - Monthly recurring revenue per client
    - `annual_contract_value` (numeric) - Total annual contract value
    - `billing_frequency` (text) - monthly, quarterly, annual
    - `last_invoice_date` (date) - Date of last invoice sent
    - `next_invoice_date` (date) - Date of next scheduled invoice

  ## Security
    - No changes to existing RLS policies
    - All new fields are optional

  ## Notes
    - Supports financial dashboard metrics
    - Enables revenue tracking and forecasting
    - Integrates with existing organization structure
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'monthly_recurring_revenue'
  ) THEN
    ALTER TABLE organizations ADD COLUMN monthly_recurring_revenue numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'annual_contract_value'
  ) THEN
    ALTER TABLE organizations ADD COLUMN annual_contract_value numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_frequency'
  ) THEN
    ALTER TABLE organizations ADD COLUMN billing_frequency text DEFAULT 'monthly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_invoice_date'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_invoice_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'next_invoice_date'
  ) THEN
    ALTER TABLE organizations ADD COLUMN next_invoice_date date;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_mrr ON organizations(monthly_recurring_revenue);
CREATE INDEX IF NOT EXISTS idx_organizations_billing ON organizations(billing_frequency);