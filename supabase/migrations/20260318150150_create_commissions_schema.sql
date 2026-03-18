/*
  # Create Commissions Schema

  This migration creates all tables needed for the commission calculation system.

  ## New Tables

  1. `sales_reps` - Sales representative profiles with commission tier info
  2. `commission_rules` - Configurable commission rate rules (by product, customer, tier, etc.)
  3. `commission_periods` - Billing periods for commission calculation (e.g., monthly, quarterly)
  4. `qbo_invoices` - Invoices pulled from QuickBooks Online via N8N
  5. `qbo_invoice_line_items` - Individual line items from QBO invoices
  6. `commission_calculations` - Calculated commission amounts per invoice/line item
  7. `commission_reports` - Generated commission reports awaiting approval
  8. `commission_report_items` - Line items in a commission report
  9. `commission_approvals` - Approval workflow records
  10. `billcom_payables` - Bill.com payable records created after approval
  11. `n8n_webhook_logs` - Audit log for N8N webhook calls

  ## Security
  - All tables have RLS enabled
  - Only Proximity Admin can manage commission data
  - Proximity Staff can view reports
*/

-- Sales Representatives
CREATE TABLE IF NOT EXISTS sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  employee_id text,
  phone text,
  territory text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  default_commission_rate numeric(5,4) NOT NULL DEFAULT 0.05,
  billcom_vendor_id text,
  billcom_vendor_name text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view sales reps"
  ON sales_reps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert sales reps"
  ON sales_reps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin')
    )
  );

CREATE POLICY "Proximity Admin can update sales reps"
  ON sales_reps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin')
    )
  );

CREATE POLICY "Proximity Admin can delete sales reps"
  ON sales_reps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin')
    )
  );

-- Commission Rules
CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sales_rep_id uuid REFERENCES sales_reps(id) ON DELETE CASCADE,
  rule_type text NOT NULL DEFAULT 'flat_rate' CHECK (rule_type IN ('flat_rate', 'tiered', 'product_specific', 'customer_specific')),
  commission_rate numeric(5,4) NOT NULL,
  min_amount numeric(12,2),
  max_amount numeric(12,2),
  applies_to_product_code text,
  applies_to_customer_name text,
  applies_to_customer_id text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  effective_from date,
  effective_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view commission rules"
  ON commission_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert commission rules"
  ON commission_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Proximity Admin can update commission rules"
  ON commission_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Proximity Admin can delete commission rules"
  ON commission_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

-- Commission Periods
CREATE TABLE IF NOT EXISTS commission_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Processing', 'Review', 'Approved', 'Paid', 'Closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commission_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view commission periods"
  ON commission_periods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert commission periods"
  ON commission_periods FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Proximity Admin can update commission periods"
  ON commission_periods FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

-- QBO Invoices (synced via N8N)
CREATE TABLE IF NOT EXISTS qbo_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_invoice_id text UNIQUE NOT NULL,
  invoice_number text,
  customer_id text,
  customer_name text NOT NULL,
  customer_email text,
  invoice_date date,
  due_date date,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Unpaid', 'Partially Paid', 'Overdue', 'Voided')),
  sales_rep_id uuid REFERENCES sales_reps(id) ON DELETE SET NULL,
  commission_period_id uuid REFERENCES commission_periods(id) ON DELETE SET NULL,
  qbo_raw_data jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE qbo_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view qbo invoices"
  ON qbo_invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert qbo invoices"
  ON qbo_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can update qbo invoices"
  ON qbo_invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- QBO Invoice Line Items
CREATE TABLE IF NOT EXISTS qbo_invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES qbo_invoices(id) ON DELETE CASCADE,
  line_num integer,
  description text,
  item_name text,
  item_code text,
  quantity numeric(12,4) DEFAULT 1,
  unit_price numeric(12,2) DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  is_commissionable boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qbo_invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view invoice line items"
  ON qbo_invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert invoice line items"
  ON qbo_invoice_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can update invoice line items"
  ON qbo_invoice_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Commission Calculations (per invoice)
CREATE TABLE IF NOT EXISTS commission_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES qbo_invoices(id) ON DELETE CASCADE,
  sales_rep_id uuid NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  commission_rule_id uuid REFERENCES commission_rules(id) ON DELETE SET NULL,
  commission_period_id uuid REFERENCES commission_periods(id) ON DELETE SET NULL,
  commissionable_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,4) NOT NULL,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  override_amount numeric(12,2),
  override_reason text,
  override_by uuid,
  notes text,
  status text NOT NULL DEFAULT 'Calculated' CHECK (status IN ('Calculated', 'Overridden', 'Excluded', 'Included')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commission_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view commission calculations"
  ON commission_calculations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert commission calculations"
  ON commission_calculations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can update commission calculations"
  ON commission_calculations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Commission Reports
CREATE TABLE IF NOT EXISTS commission_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text UNIQUE,
  sales_rep_id uuid NOT NULL REFERENCES sales_reps(id) ON DELETE CASCADE,
  commission_period_id uuid REFERENCES commission_periods(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_invoices integer NOT NULL DEFAULT 0,
  total_invoice_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_commissionable_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Rejected', 'Paid', 'Emailed')),
  generated_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  emailed_at timestamptz,
  pdf_storage_path text,
  billcom_payable_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commission_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view commission reports"
  ON commission_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert commission reports"
  ON commission_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can update commission reports"
  ON commission_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can delete commission reports"
  ON commission_reports FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

-- Commission Report Items (invoices linked to a report)
CREATE TABLE IF NOT EXISTS commission_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES commission_reports(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES qbo_invoices(id) ON DELETE CASCADE,
  calculation_id uuid REFERENCES commission_calculations(id) ON DELETE SET NULL,
  commissionable_amount numeric(12,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,4) NOT NULL,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_included boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE commission_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view report items"
  ON commission_report_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert report items"
  ON commission_report_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can update report items"
  ON commission_report_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- N8N Webhook Logs
CREATE TABLE IF NOT EXISTS n8n_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_type text NOT NULL,
  payload jsonb,
  records_processed integer DEFAULT 0,
  status text NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Failed', 'Partial')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE n8n_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity Admin and Staff can view webhook logs"
  ON n8n_webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity Admin can insert webhook logs"
  ON n8n_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_sales_rep ON qbo_invoices(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_period ON qbo_invoices(commission_period_id);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_status ON qbo_invoices(status);
CREATE INDEX IF NOT EXISTS idx_qbo_invoices_date ON qbo_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_qbo_line_items_invoice ON qbo_invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_invoice ON commission_calculations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_rep ON commission_calculations(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_period ON commission_calculations(commission_period_id);
CREATE INDEX IF NOT EXISTS idx_commission_reports_rep ON commission_reports(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_commission_reports_status ON commission_reports(status);
CREATE INDEX IF NOT EXISTS idx_commission_report_items_report ON commission_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_rep ON commission_rules(sales_rep_id);
