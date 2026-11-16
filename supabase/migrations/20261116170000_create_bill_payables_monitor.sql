/*
  # BILL Payables Monitor (Phase 1)

  Read-only copy of our BILL accounts payable data, refreshed by the
  `bill-sync` edge function, plus the Spend dashboard queries.

  ## Tables (all Super Admin read-only; written only by the edge function
  ## through the service role)
  - ap_classifications: GL accounts, departments, classes and locations
  - ap_vendors: vendors (no tax IDs or bank account details are stored)
  - ap_bills / ap_bill_lines: bills and their line items with coding
  - ap_payments / ap_payment_bills: payments and the amount applied to each bill
  - ap_vendor_credits: vendor credits
  - ap_sync_state: per-entity high-water mark (last updatedTime synced)
  - ap_sync_runs: one row per sync run, for status and troubleshooting

  ## Functions
  - ap_spend_facts(basis): one row per dollar of spend, by billed or paid basis
  - ap_spend_dashboard(...): every number and chart on the Spend dashboard
  - ap_vendor_detail(vendor_id): vendor drill-down
  - ap_filter_options(): names for the filter dropdowns
*/

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ap_classifications (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('chart_of_account', 'department', 'accounting_class', 'location')),
  name text NOT NULL,
  parent_id text,
  archived boolean NOT NULL DEFAULT false,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_classifications_kind ON ap_classifications(kind);

CREATE TABLE IF NOT EXISTS ap_vendors (
  id text PRIMARY KEY,
  name text NOT NULL,
  short_name text,
  email text,
  phone text,
  city text,
  state text,
  archived boolean NOT NULL DEFAULT false,
  balance numeric(14,2),
  autopay_enabled boolean,
  bank_account_status text,
  network_status text,
  pay_by_type text,
  last_payment_date date,
  created_time timestamptz,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_bills (
  id text PRIMARY KEY,
  vendor_id text,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  due_amount numeric(14,2) NOT NULL DEFAULT 0,
  scheduled_amount numeric(14,2) NOT NULL DEFAULT 0,
  credit_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text,
  payment_status text,
  approval_status text,
  description text,
  po_number text,
  recurring_bill_id text,
  chart_of_account_id text,
  accounting_class_id text,
  department_id text,
  location_id text,
  archived boolean NOT NULL DEFAULT false,
  created_time timestamptz,
  updated_time timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_bills_vendor ON ap_bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_bills_invoice_date ON ap_bills(invoice_date);
CREATE INDEX IF NOT EXISTS idx_ap_bills_due_date ON ap_bills(due_date);

CREATE TABLE IF NOT EXISTS ap_bill_lines (
  id text PRIMARY KEY,
  bill_id text NOT NULL REFERENCES ap_bills(id) ON DELETE CASCADE,
  line_order integer NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  chart_of_account_id text,
  accounting_class_id text,
  department_id text,
  location_id text
);
CREATE INDEX IF NOT EXISTS idx_ap_bill_lines_bill ON ap_bill_lines(bill_id);

CREATE TABLE IF NOT EXISTS ap_payments (
  id text PRIMARY KEY,
  vendor_id text,
  vendor_name text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  process_date date,
  status text,
  single_status text,
  disbursement_type text,
  disbursement_status text,
  online_payment boolean,
  transaction_number text,
  confirmation_number text,
  description text,
  created_time timestamptz,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_payments_vendor ON ap_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ap_payments_process_date ON ap_payments(process_date);

CREATE TABLE IF NOT EXISTS ap_payment_bills (
  payment_id text NOT NULL REFERENCES ap_payments(id) ON DELETE CASCADE,
  bill_id text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (payment_id, bill_id)
);
CREATE INDEX IF NOT EXISTS idx_ap_payment_bills_bill ON ap_payment_bills(bill_id);

CREATE TABLE IF NOT EXISTS ap_vendor_credits (
  id text PRIMARY KEY,
  vendor_id text,
  reference_number text,
  credit_date date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  applied_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text,
  description text,
  archived boolean NOT NULL DEFAULT false,
  created_time timestamptz,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_sync_state (
  entity text PRIMARY KEY,
  last_updated_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  triggered_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ap_sync_runs_started ON ap_sync_runs(started_at DESC);

-- ── Row level security: Super Admin can read; nobody writes from the app ──

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ap_classifications','ap_vendors','ap_bills','ap_bill_lines','ap_payments',
                           'ap_payment_bills','ap_vendor_credits','ap_sync_state','ap_sync_runs']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super Admin can read" ON %I', t);
    EXECUTE format('CREATE POLICY "Super Admin can read" ON %I FOR SELECT TO authenticated USING (is_super_admin())', t);
  END LOOP;
END $$;

-- ── Spend facts ───────────────────────────────────────────────────────────
-- One row per piece of spend, coded to GL account, department, class and location.
-- billed: each bill line on the bill's invoice date (bills without lines count whole).
-- paid:   each payment's amount applied to a bill, on the payment's process date,
--         split across the bill's lines in proportion to line amounts.
-- Archived bills are excluded. Payments count once BILL has started processing them.

CREATE OR REPLACE FUNCTION ap_spend_facts(p_basis text DEFAULT 'billed')
RETURNS TABLE (
  spend_date date,
  amount numeric,
  bill_id text,
  vendor_id text,
  vendor_name text,
  chart_of_account_id text,
  department_id text,
  accounting_class_id text,
  location_id text,
  is_recurring boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH bill_parts AS (
    SELECT b.id AS bill_id,
           COALESCE(l.amount, b.amount) AS part_amount,
           CASE WHEN l.id IS NULL THEN 1
                WHEN SUM(l.amount) OVER (PARTITION BY b.id) = 0 THEN 1.0 / COUNT(*) OVER (PARTITION BY b.id)
                ELSE l.amount / SUM(l.amount) OVER (PARTITION BY b.id) END AS share,
           COALESCE(b.invoice_date, b.created_time::date) AS bill_date,
           b.vendor_id, b.vendor_name,
           COALESCE(l.chart_of_account_id, b.chart_of_account_id) AS chart_of_account_id,
           COALESCE(l.department_id, b.department_id) AS department_id,
           COALESCE(l.accounting_class_id, b.accounting_class_id) AS accounting_class_id,
           COALESCE(l.location_id, b.location_id) AS location_id,
           b.recurring_bill_id IS NOT NULL AS is_recurring
    FROM ap_bills b
    LEFT JOIN ap_bill_lines l ON l.bill_id = b.id
    WHERE NOT b.archived
  )
  SELECT bp.bill_date, bp.part_amount, bp.bill_id, bp.vendor_id, bp.vendor_name,
         bp.chart_of_account_id, bp.department_id, bp.accounting_class_id, bp.location_id, bp.is_recurring
  FROM bill_parts bp
  WHERE p_basis = 'billed'
  UNION ALL
  SELECT p.process_date,
         ROUND(pb.amount * COALESCE(bp.share, 1), 2),
         pb.bill_id, p.vendor_id, p.vendor_name,
         bp.chart_of_account_id, bp.department_id, bp.accounting_class_id, bp.location_id,
         COALESCE(bp.is_recurring, false)
  FROM ap_payments p
  JOIN ap_payment_bills pb ON pb.payment_id = p.id
  LEFT JOIN bill_parts bp ON bp.bill_id = pb.bill_id
  WHERE p_basis = 'paid'
    AND p.process_date IS NOT NULL
    AND COALESCE(p.single_status, '') NOT IN (
      'SCHEDULED', 'WAITING_ON_APPROVAL', 'CANCELED', 'CANCELLATION_IN_PROGRESS',
      'VOIDED', 'VOID_PENDING', 'FUNDING_FAILED_VOIDED', 'FUNDING_FAILED_ACTION_NEEDED',
      'DISBURSEMENT_FAILED_ACTION_NEEDED', 'DISBURSEMENT_FAILED_VENDOR_BANK_REJECTED', 'UNDEFINED'
    );
$$;

-- ── Spend dashboard ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_spend_dashboard(
  p_from date,
  p_to date,
  p_basis text DEFAULT 'billed',
  p_vendor_id text DEFAULT NULL,
  p_chart_of_account_id text DEFAULT NULL,
  p_department_id text DEFAULT NULL,
  p_accounting_class_id text DEFAULT NULL,
  p_location_id text DEFAULT NULL,
  p_group_by text DEFAULT 'chart_of_account',
  p_today date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_trend_start date := (date_trunc('month', p_to) - interval '23 months')::date;
  v_trend_end date := (date_trunc('month', p_to) + interval '1 month - 1 day')::date;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_basis NOT IN ('billed', 'paid') THEN
    RAISE EXCEPTION 'Basis must be billed or paid';
  END IF;
  IF p_group_by NOT IN ('chart_of_account', 'department') THEN
    RAISE EXCEPTION 'Group by must be chart_of_account or department';
  END IF;

  DROP TABLE IF EXISTS pg_temp._ap_facts;
  CREATE TEMP TABLE _ap_facts ON COMMIT DROP AS
    SELECT * FROM ap_spend_facts(p_basis) WHERE false;
  INSERT INTO _ap_facts
    SELECT f.* FROM ap_spend_facts(p_basis) f
    WHERE (p_vendor_id IS NULL OR f.vendor_id = p_vendor_id)
      AND (p_chart_of_account_id IS NULL OR f.chart_of_account_id = p_chart_of_account_id)
      AND (p_department_id IS NULL OR f.department_id = p_department_id)
      AND (p_accounting_class_id IS NULL OR f.accounting_class_id = p_accounting_class_id)
      AND (p_location_id IS NULL OR f.location_id = p_location_id);

  WITH
  names AS (SELECT id, name FROM ap_classifications),
  in_range AS (SELECT * FROM _ap_facts WHERE spend_date BETWEEN p_from AND p_to),
  totals AS (
    SELECT
      COALESCE(SUM(amount), 0) AS total,
      COUNT(DISTINCT bill_id) AS bill_count,
      COUNT(DISTINCT vendor_id) AS vendor_count
    FROM in_range
  ),
  prior AS (
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM _ap_facts
    WHERE spend_date BETWEEN (p_from - interval '1 year')::date AND (p_to - interval '1 year')::date
  ),
  periods AS (
    SELECT * FROM (VALUES
      ('month',   date_trunc('month', p_today)::date),
      ('quarter', date_trunc('quarter', p_today)::date),
      ('year',    date_trunc('year', p_today)::date)
    ) AS t(period, start_date)
  ),
  period_totals AS (
    SELECT pr.period,
      (SELECT COALESCE(SUM(amount), 0) FROM _ap_facts WHERE spend_date BETWEEN pr.start_date AND p_today) AS current_total,
      (SELECT COALESCE(SUM(amount), 0) FROM _ap_facts
        WHERE spend_date BETWEEN (pr.start_date - interval '1 year')::date AND (p_today - interval '1 year')::date) AS prior_total
    FROM periods pr
  ),
  trend_raw AS (
    SELECT date_trunc('month', spend_date)::date AS month,
           CASE WHEN p_group_by = 'department' THEN department_id ELSE chart_of_account_id END AS group_id,
           SUM(amount) AS amount
    FROM _ap_facts
    WHERE spend_date BETWEEN v_trend_start AND v_trend_end
    GROUP BY 1, 2
  ),
  top_groups AS (
    SELECT group_id, row_number() OVER (ORDER BY SUM(amount) DESC) AS ord
    FROM trend_raw WHERE group_id IS NOT NULL
    GROUP BY group_id ORDER BY SUM(amount) DESC LIMIT 7
  ),
  trend_grouped AS (
    SELECT month,
           CASE WHEN group_id IN (SELECT group_id FROM top_groups) THEN group_id
                WHEN group_id IS NULL THEN '__uncoded'
                ELSE '__other' END AS group_id,
           SUM(amount) AS amount
    FROM trend_raw GROUP BY 1, 2
  ),
  months AS (
    SELECT generate_series(v_trend_start, date_trunc('month', p_to)::date, interval '1 month')::date AS month
  ),
  breakdown AS (
    SELECT 'chart_of_account' AS dim, chart_of_account_id AS id, SUM(amount) AS amount FROM in_range GROUP BY 2
    UNION ALL SELECT 'department', department_id, SUM(amount) FROM in_range GROUP BY 2
    UNION ALL SELECT 'accounting_class', accounting_class_id, SUM(amount) FROM in_range GROUP BY 2
    UNION ALL SELECT 'location', location_id, SUM(amount) FROM in_range GROUP BY 2
  ),
  top_vendors AS (
    SELECT vendor_id, MAX(vendor_name) AS vendor_name, SUM(amount) AS amount, COUNT(DISTINCT bill_id) AS bill_count
    FROM in_range GROUP BY vendor_id ORDER BY SUM(amount) DESC LIMIT 15
  ),
  -- Watch list works on whole bills (billed basis), whatever the basis toggle says.
  bills_f AS (
    SELECT b.* FROM ap_bills b
    WHERE NOT b.archived
      AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
      AND b.id IN (SELECT DISTINCT bill_id FROM _ap_facts)
  ),
  large_bills AS (
    SELECT b.id, b.vendor_id, b.vendor_name, b.invoice_number, COALESCE(b.invoice_date, b.created_time::date) AS bill_date,
           b.amount, h.avg_amount
    FROM bills_f b
    JOIN LATERAL (
      SELECT AVG(o.amount) AS avg_amount, COUNT(*) AS n
      FROM ap_bills o
      WHERE o.vendor_id = b.vendor_id AND o.id <> b.id AND NOT o.archived
        AND COALESCE(o.invoice_date, o.created_time::date)
            BETWEEN COALESCE(b.invoice_date, b.created_time::date) - 365 AND COALESCE(b.invoice_date, b.created_time::date)
    ) h ON h.n >= 3
    WHERE COALESCE(b.invoice_date, b.created_time::date) BETWEEN p_from AND p_to
      AND b.amount > 2 * h.avg_amount
    ORDER BY b.amount DESC LIMIT 25
  ),
  new_vendors AS (
    SELECT b.vendor_id, MAX(b.vendor_name) AS vendor_name, MIN(COALESCE(b.invoice_date, b.created_time::date)) AS first_bill_date,
           SUM(b.amount) FILTER (WHERE COALESCE(b.invoice_date, b.created_time::date) BETWEEN p_from AND p_to) AS amount_in_range
    FROM ap_bills b
    WHERE NOT b.archived AND (p_vendor_id IS NULL OR b.vendor_id = p_vendor_id)
    GROUP BY b.vendor_id
    HAVING MIN(COALESCE(b.invoice_date, b.created_time::date)) BETWEEN p_from AND p_to
    ORDER BY 3 DESC LIMIT 25
  ),
  duplicates AS (
    SELECT a.id AS bill_id, d.id AS other_bill_id, a.vendor_id, a.vendor_name, a.amount,
           a.invoice_number, d.invoice_number AS other_invoice_number,
           COALESCE(a.invoice_date, a.created_time::date) AS bill_date,
           COALESCE(d.invoice_date, d.created_time::date) AS other_bill_date
    FROM bills_f a
    JOIN ap_bills d ON d.vendor_id = a.vendor_id AND d.id > a.id AND NOT d.archived
      AND d.amount = a.amount AND a.amount > 0
      AND (a.recurring_bill_id IS NULL OR d.recurring_bill_id IS DISTINCT FROM a.recurring_bill_id)
      AND ABS(COALESCE(d.invoice_date, d.created_time::date) - COALESCE(a.invoice_date, a.created_time::date)) <= 30
    WHERE COALESCE(a.invoice_date, a.created_time::date) BETWEEN p_from AND p_to
       OR COALESCE(d.invoice_date, d.created_time::date) BETWEEN p_from AND p_to
    ORDER BY a.amount DESC LIMIT 25
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'basis', p_basis, 'group_by', p_group_by),
    'kpis', jsonb_build_object(
      'total', t.total,
      'prior_year_total', pr.total,
      'bill_count', t.bill_count,
      'vendor_count', t.vendor_count,
      'average_bill', CASE WHEN t.bill_count > 0 THEN ROUND(t.total / t.bill_count, 2) ELSE 0 END,
      'periods', (SELECT jsonb_object_agg(period, jsonb_build_object('current', current_total, 'prior', prior_total)) FROM period_totals)
    ),
    'trend', jsonb_build_object(
      'groups', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', g.group_id, 'name',
                 CASE g.group_id WHEN '__other' THEN 'Other' WHEN '__uncoded' THEN 'Not coded'
                      ELSE COALESCE((SELECT name FROM names WHERE id = g.group_id), g.group_id) END)
                 ORDER BY g.ord), '[]'::jsonb)
        FROM (
          SELECT group_id, ord FROM top_groups
          UNION ALL SELECT '__other', 1000 WHERE EXISTS (SELECT 1 FROM trend_grouped WHERE group_id = '__other')
          UNION ALL SELECT '__uncoded', 1001 WHERE EXISTS (SELECT 1 FROM trend_grouped WHERE group_id = '__uncoded')
        ) g
      ),
      'months', (
        SELECT jsonb_agg(jsonb_build_object(
          'month', m.month,
          'total', COALESCE((SELECT SUM(amount) FROM trend_grouped tg WHERE tg.month = m.month), 0),
          'by_group', COALESCE((SELECT jsonb_object_agg(tg.group_id, tg.amount) FROM trend_grouped tg WHERE tg.month = m.month), '{}'::jsonb)
        ) ORDER BY m.month)
        FROM months m
      )
    ),
    'top_vendors', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('vendor_id', vendor_id, 'vendor_name', vendor_name, 'amount', amount,
               'bill_count', bill_count, 'share', CASE WHEN t.total > 0 THEN ROUND(amount / t.total, 4) ELSE 0 END)
             ORDER BY amount DESC)
      FROM top_vendors), '[]'::jsonb),
    'breakdowns', COALESCE((
      SELECT jsonb_object_agg(dim, rows) FROM (
        SELECT dim, jsonb_agg(jsonb_build_object('id', id,
                 'name', COALESCE((SELECT name FROM names WHERE names.id = breakdown.id), CASE WHEN id IS NULL THEN 'Not coded' ELSE id END),
                 'amount', amount) ORDER BY amount DESC) AS rows
        FROM breakdown GROUP BY dim
      ) x
    ), '{}'::jsonb),
    'recurring', jsonb_build_object(
      'recurring', (SELECT COALESCE(SUM(amount), 0) FROM in_range WHERE is_recurring),
      'one_time', (SELECT COALESCE(SUM(amount), 0) FROM in_range WHERE NOT is_recurring)
    ),
    'watch', jsonb_build_object(
      'large_bills', COALESCE((SELECT jsonb_agg(to_jsonb(lb)) FROM large_bills lb), '[]'::jsonb),
      'new_vendors', COALESCE((SELECT jsonb_agg(to_jsonb(nv)) FROM new_vendors nv), '[]'::jsonb),
      'duplicates', COALESCE((SELECT jsonb_agg(to_jsonb(du)) FROM duplicates du), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM totals t, prior pr;

  RETURN v_result;
END;
$$;

-- ── Vendor drill-down ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_vendor_detail(p_vendor_id text, p_today date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_start date := (date_trunc('month', p_today) - interval '23 months')::date;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'vendor', (SELECT to_jsonb(v) FROM ap_vendors v WHERE v.id = p_vendor_id),
    'open_balance', (SELECT COALESCE(SUM(due_amount), 0) FROM ap_bills WHERE vendor_id = p_vendor_id AND NOT archived),
    'average_days_to_pay', (
      SELECT ROUND(AVG(p.process_date - COALESCE(b.invoice_date, b.created_time::date))::numeric, 1)
      FROM ap_payments p
      JOIN ap_payment_bills pb ON pb.payment_id = p.id
      JOIN ap_bills b ON b.id = pb.bill_id
      WHERE p.vendor_id = p_vendor_id AND p.process_date IS NOT NULL
        AND COALESCE(p.single_status, '') NOT IN ('SCHEDULED', 'CANCELED', 'VOIDED', 'VOID_PENDING', 'FUNDING_FAILED_VOIDED')
    ),
    'monthly', (
      SELECT jsonb_agg(jsonb_build_object('month', m.month,
               'billed', COALESCE((SELECT SUM(amount) FROM ap_bills b WHERE b.vendor_id = p_vendor_id AND NOT b.archived
                                   AND date_trunc('month', COALESCE(b.invoice_date, b.created_time::date)) = m.month), 0),
               'paid', COALESCE((SELECT SUM(amount) FROM ap_payments p WHERE p.vendor_id = p_vendor_id
                                   AND date_trunc('month', p.process_date) = m.month
                                   AND COALESCE(p.single_status, '') NOT IN ('SCHEDULED', 'CANCELED', 'VOIDED', 'VOID_PENDING', 'FUNDING_FAILED_VOIDED')), 0))
             ORDER BY m.month)
      FROM generate_series(v_start, date_trunc('month', p_today)::date, interval '1 month') AS m(month)
    ),
    'bills', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'invoice_number', invoice_number, 'invoice_date', invoice_date,
               'due_date', due_date, 'amount', amount, 'due_amount', due_amount, 'payment_status', payment_status,
               'approval_status', approval_status) ORDER BY COALESCE(invoice_date, created_time::date) DESC)
      FROM (SELECT * FROM ap_bills WHERE vendor_id = p_vendor_id AND NOT archived
            ORDER BY COALESCE(invoice_date, created_time::date) DESC LIMIT 100) b), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'process_date', process_date, 'amount', amount,
               'status', COALESCE(single_status, status), 'disbursement_type', disbursement_type,
               'confirmation_number', confirmation_number) ORDER BY process_date DESC NULLS LAST)
      FROM (SELECT * FROM ap_payments WHERE vendor_id = p_vendor_id
            ORDER BY process_date DESC NULLS LAST LIMIT 100) p), '[]'::jsonb)
  );
END;
$$;

-- ── Filter options ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_filter_options()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'vendors', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
                         FROM ap_vendors WHERE NOT archived OR id IN (SELECT vendor_id FROM ap_bills)), '[]'::jsonb),
    'chart_of_account', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
                         FROM ap_classifications WHERE kind = 'chart_of_account'), '[]'::jsonb),
    'department', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
                         FROM ap_classifications WHERE kind = 'department'), '[]'::jsonb),
    'accounting_class', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
                         FROM ap_classifications WHERE kind = 'accounting_class'), '[]'::jsonb),
    'location', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY lower(name))
                         FROM ap_classifications WHERE kind = 'location'), '[]'::jsonb),
    'last_sync', (SELECT to_jsonb(r) FROM (SELECT id, status, counts, error, started_at, finished_at, trigger
                                           FROM ap_sync_runs ORDER BY started_at DESC LIMIT 1) r),
    'last_success', (SELECT MAX(finished_at) FROM ap_sync_runs WHERE status = 'succeeded')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ap_spend_facts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_spend_dashboard(date, date, text, text, text, text, text, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_vendor_detail(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_filter_options() TO authenticated;
