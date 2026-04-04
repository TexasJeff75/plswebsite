/*
  # Consolidate Super Admin RLS Policies

  ## Summary
  The Super Admin bypass policies added in migration 20260320142902 create
  "Multiple Permissive Policies" warnings because they duplicate existing
  policies for the same action on the same table. Since is_super_admin() 
  is already included in is_internal_user() (or checked separately), we 
  can fold super admin access into the existing policies and drop the 
  redundant standalone Super Admin policies.

  ## Approach
  Drop all "Super Admin full access", "Super Admin insert", "Super Admin update",
  and "Super Admin delete" policies from every table. Then update the existing
  policies to include is_super_admin() checks where is_internal_user() is 
  insufficient (e.g., commission tables restricted to Proximity Admin/Staff).

  The is_super_admin() function already has SECURITY DEFINER and bypasses RLS
  internally, so we just need to add it to the USING/WITH CHECK expressions.
*/

-- Helper: drop all standalone Super Admin policies across all tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'Super Admin full access',
        'Super Admin insert',
        'Super Admin update',
        'Super Admin delete'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Now update commission/internal-only table policies to include Super Admin
-- (these tables restrict to Proximity Admin/Staff roles, not all internal users)

-- commission_rules
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission rules" ON commission_rules;
CREATE POLICY "Proximity Admin and Staff can view commission rules"
  ON commission_rules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert commission rules" ON commission_rules;
CREATE POLICY "Proximity Admin can insert commission rules"
  ON commission_rules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update commission rules" ON commission_rules;
CREATE POLICY "Proximity Admin can update commission rules"
  ON commission_rules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can delete commission rules" ON commission_rules;
CREATE POLICY "Proximity Admin can delete commission rules"
  ON commission_rules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- sales_reps
DROP POLICY IF EXISTS "Proximity Admin and Staff can view sales reps" ON sales_reps;
CREATE POLICY "Proximity Admin and Staff can view sales reps"
  ON sales_reps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert sales reps" ON sales_reps;
CREATE POLICY "Proximity Admin can insert sales reps"
  ON sales_reps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update sales reps" ON sales_reps;
CREATE POLICY "Proximity Admin can update sales reps"
  ON sales_reps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can delete sales reps" ON sales_reps;
CREATE POLICY "Proximity Admin can delete sales reps"
  ON sales_reps FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- qbo_invoices
DROP POLICY IF EXISTS "Proximity Admin and Staff can view qbo invoices" ON qbo_invoices;
CREATE POLICY "Proximity Admin and Staff can view qbo invoices"
  ON qbo_invoices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert qbo invoices" ON qbo_invoices;
CREATE POLICY "Proximity Admin can insert qbo invoices"
  ON qbo_invoices FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update qbo invoices" ON qbo_invoices;
CREATE POLICY "Proximity Admin can update qbo invoices"
  ON qbo_invoices FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- qbo_invoice_line_items
DROP POLICY IF EXISTS "Proximity Admin and Staff can view invoice line items" ON qbo_invoice_line_items;
CREATE POLICY "Proximity Admin and Staff can view invoice line items"
  ON qbo_invoice_line_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert invoice line items" ON qbo_invoice_line_items;
CREATE POLICY "Proximity Admin can insert invoice line items"
  ON qbo_invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update invoice line items" ON qbo_invoice_line_items;
CREATE POLICY "Proximity Admin can update invoice line items"
  ON qbo_invoice_line_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- commission_periods
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission periods" ON commission_periods;
CREATE POLICY "Proximity Admin and Staff can view commission periods"
  ON commission_periods FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert commission periods" ON commission_periods;
CREATE POLICY "Proximity Admin can insert commission periods"
  ON commission_periods FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update commission periods" ON commission_periods;
CREATE POLICY "Proximity Admin can update commission periods"
  ON commission_periods FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- commission_calculations
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission calculations" ON commission_calculations;
CREATE POLICY "Proximity Admin and Staff can view commission calculations"
  ON commission_calculations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert commission calculations" ON commission_calculations;
CREATE POLICY "Proximity Admin can insert commission calculations"
  ON commission_calculations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update commission calculations" ON commission_calculations;
CREATE POLICY "Proximity Admin can update commission calculations"
  ON commission_calculations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- commission_report_items
DROP POLICY IF EXISTS "Proximity Admin and Staff can view report items" ON commission_report_items;
CREATE POLICY "Proximity Admin and Staff can view report items"
  ON commission_report_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert report items" ON commission_report_items;
CREATE POLICY "Proximity Admin can insert report items"
  ON commission_report_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update report items" ON commission_report_items;
CREATE POLICY "Proximity Admin can update report items"
  ON commission_report_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- commission_reports
DROP POLICY IF EXISTS "Proximity Admin and Staff can view commission reports" ON commission_reports;
CREATE POLICY "Proximity Admin and Staff can view commission reports"
  ON commission_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert commission reports" ON commission_reports;
CREATE POLICY "Proximity Admin can insert commission reports"
  ON commission_reports FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can update commission reports" ON commission_reports;
CREATE POLICY "Proximity Admin can update commission reports"
  ON commission_reports FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can delete commission reports" ON commission_reports;
CREATE POLICY "Proximity Admin can delete commission reports"
  ON commission_reports FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- commission_settings
DROP POLICY IF EXISTS "Staff can read commission settings" ON commission_settings;
CREATE POLICY "Staff can read commission settings"
  ON commission_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Staff can insert commission settings" ON commission_settings;
CREATE POLICY "Staff can insert commission settings"
  ON commission_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Staff can update commission settings" ON commission_settings;
CREATE POLICY "Staff can update commission settings"
  ON commission_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

-- n8n_webhook_logs
DROP POLICY IF EXISTS "Proximity Admin and Staff can view webhook logs" ON n8n_webhook_logs;
CREATE POLICY "Proximity Admin and Staff can view webhook logs"
  ON n8n_webhook_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity Admin can insert webhook logs" ON n8n_webhook_logs;
CREATE POLICY "Proximity Admin can insert webhook logs"
  ON n8n_webhook_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Super Admin')
    )
  );

-- qb_import_batches
DROP POLICY IF EXISTS "Proximity staff can view import batches" ON qb_import_batches;
CREATE POLICY "Proximity staff can view import batches"
  ON qb_import_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );

DROP POLICY IF EXISTS "Proximity staff can insert import batches" ON qb_import_batches;
CREATE POLICY "Proximity staff can insert import batches"
  ON qb_import_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
    )
  );
