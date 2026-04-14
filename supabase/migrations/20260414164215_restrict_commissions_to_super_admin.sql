/*
  # Restrict Commissions Access to Super Admin Only

  ## Summary
  Updates all Row Level Security policies on commission-related tables to restrict
  access exclusively to the Super Admin role. Previously, Proximity Admin and
  Proximity Staff could also view commission data. This change locks all commission
  data to Super Admin only.

  ## Tables Affected
  - sales_reps
  - commission_rules
  - commission_periods
  - qbo_invoices
  - qbo_invoice_line_items
  - commission_calculations
  - commission_reports
  - commission_report_items
  - commission_settings
  - qb_import_batches

  ## Security Changes
  - All SELECT, INSERT, UPDATE, DELETE policies replaced with Super Admin-only versions
*/

-- ============================================================
-- sales_reps
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can insert sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can update sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Proximity Admin can delete sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin can view sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin can insert sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin can update sales reps" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin can delete sales reps" ON sales_reps;

CREATE POLICY "Super Admin can view sales reps"
  ON sales_reps FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert sales reps"
  ON sales_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update sales reps"
  ON sales_reps FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete sales reps"
  ON sales_reps FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_rules
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can insert commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can update commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Proximity Admin can delete commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin can view commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin can insert commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin can update commission rules" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin can delete commission rules" ON commission_rules;

CREATE POLICY "Super Admin can view commission rules"
  ON commission_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission rules"
  ON commission_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission rules"
  ON commission_rules FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete commission rules"
  ON commission_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_periods
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Proximity Admin can insert commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Proximity Admin can update commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Proximity Admin can delete commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin can view commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin can insert commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin can update commission periods" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin can delete commission periods" ON commission_periods;

CREATE POLICY "Super Admin can view commission periods"
  ON commission_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission periods"
  ON commission_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission periods"
  ON commission_periods FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete commission periods"
  ON commission_periods FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- qbo_invoices
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Proximity Admin can insert QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Proximity Admin can update QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Proximity Admin can delete QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin can view QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin can insert QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin can update QBO invoices" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin can delete QBO invoices" ON qbo_invoices;

CREATE POLICY "Super Admin can view QBO invoices"
  ON qbo_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert QBO invoices"
  ON qbo_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update QBO invoices"
  ON qbo_invoices FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete QBO invoices"
  ON qbo_invoices FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- qbo_invoice_line_items
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Proximity Admin can insert QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Proximity Admin can update QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Proximity Admin can delete QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin can view QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin can insert QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin can update QBO line items" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin can delete QBO line items" ON qbo_invoice_line_items;

CREATE POLICY "Super Admin can view QBO line items"
  ON qbo_invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert QBO line items"
  ON qbo_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update QBO line items"
  ON qbo_invoice_line_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete QBO line items"
  ON qbo_invoice_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_calculations
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Proximity Admin can insert commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Proximity Admin can update commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Proximity Admin can delete commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin can view commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin can insert commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin can update commission calculations" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin can delete commission calculations" ON commission_calculations;

CREATE POLICY "Super Admin can view commission calculations"
  ON commission_calculations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission calculations"
  ON commission_calculations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission calculations"
  ON commission_calculations FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete commission calculations"
  ON commission_calculations FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_reports
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can insert commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can update commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Proximity Admin can delete commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin can view commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin can insert commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin can update commission reports" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin can delete commission reports" ON commission_reports;

CREATE POLICY "Super Admin can view commission reports"
  ON commission_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission reports"
  ON commission_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission reports"
  ON commission_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete commission reports"
  ON commission_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_report_items
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Proximity Admin can insert commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Proximity Admin can update commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Proximity Admin can delete commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin can view commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin can insert commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin can update commission report items" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin can delete commission report items" ON commission_report_items;

CREATE POLICY "Super Admin can view commission report items"
  ON commission_report_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission report items"
  ON commission_report_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission report items"
  ON commission_report_items FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

CREATE POLICY "Super Admin can delete commission report items"
  ON commission_report_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

-- ============================================================
-- commission_settings
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Proximity Admin can insert commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Proximity Admin can update commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin can view commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin can insert commission settings" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin can update commission settings" ON commission_settings;

CREATE POLICY "Super Admin can view commission settings"
  ON commission_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert commission settings"
  ON commission_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update commission settings"
  ON commission_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

-- ============================================================
-- qb_import_batches
-- ============================================================
DROP POLICY IF EXISTS "Proximity Admin and Staff can view import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Proximity Admin can insert import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Proximity Admin can update import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin can view import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin can insert import batches" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin can update import batches" ON qb_import_batches;

CREATE POLICY "Super Admin can view import batches"
  ON qb_import_batches FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can insert import batches"
  ON qb_import_batches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin')
  );

CREATE POLICY "Super Admin can update import batches"
  ON qb_import_batches FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Super Admin'));

-- ============================================================
-- n8n_webhook_logs (if exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'n8n_webhook_logs' AND table_schema = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Proximity Admin and Staff can view webhook logs" ON n8n_webhook_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Proximity Admin can insert webhook logs" ON n8n_webhook_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Super Admin can view webhook logs" ON n8n_webhook_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Super Admin can insert webhook logs" ON n8n_webhook_logs';

    EXECUTE 'CREATE POLICY "Super Admin can view webhook logs"
      ON n8n_webhook_logs FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ''Super Admin''))';

    EXECUTE 'CREATE POLICY "Super Admin can insert webhook logs"
      ON n8n_webhook_logs FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ''Super Admin''))';
  END IF;
END $$;
