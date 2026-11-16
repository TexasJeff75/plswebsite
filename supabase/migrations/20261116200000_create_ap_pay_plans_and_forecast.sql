/*
  # BILL Payables Monitor (Phase 2): Pay Plan and Forecast

  Pay plans live only in the tracker; payments are still made in BILL.
  After each sync, BILL payments are matched to planned installments.

  ## Tables (Super Admin only)
  - ap_pay_plans: one plan per bill (full, weekly, custom or hold)
  - ap_pay_plan_installments: planned dates and amounts, with match status
  - ap_plan_changes: who changed which plan, when, before and after
  - ap_settings: starting cash balance and minimum cash cushion

  ## Matching rule
  A BILL payment matches an installment when it is applied to the same bill,
  for the same amount (within $0.01), with a process date within 3 days of
  the planned date. Earliest open installment wins. Manual links are kept.

  ## Installment status
  planned   in the tracker only
  scheduled matched to a BILL payment that has not been processed yet
  paid      matched payment processed by BILL
  missed    more than 3 days past the planned date with no match

  ## BILL amounts used
  due_amount       = amount - credits - scheduled - cleared (left to schedule)
  scheduled_amount = payments pending clearance
  still owed       = due_amount + scheduled_amount
*/

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ap_pay_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id text NOT NULL UNIQUE REFERENCES ap_bills(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('full', 'weekly', 'custom', 'hold')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_pay_plan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES ap_pay_plans(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  planned_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'paid', 'missed')),
  matched_payment_id text,
  matched_by text CHECK (matched_by IN ('auto', 'manual')),
  bill_process_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_installments_plan ON ap_pay_plan_installments(plan_id);
CREATE INDEX IF NOT EXISTS idx_ap_installments_date ON ap_pay_plan_installments(planned_date);
CREATE INDEX IF NOT EXISTS idx_ap_installments_payment ON ap_pay_plan_installments(matched_payment_id);

CREATE TABLE IF NOT EXISTS ap_plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id text NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_plan_changes_bill ON ap_plan_changes(bill_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS ap_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starting_cash numeric(14,2),
  min_cash numeric(14,2),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Super Admin can read everything; writes go through the functions below.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ap_pay_plans','ap_pay_plan_installments','ap_plan_changes','ap_settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super Admin can read" ON %I', t);
    EXECUTE format('CREATE POLICY "Super Admin can read" ON %I FOR SELECT TO authenticated USING (is_super_admin())', t);
  END LOOP;
END $$;

-- ── Helpers ───────────────────────────────────────────────────────────────

-- Payment states that will never move money.
CREATE OR REPLACE FUNCTION ap_payment_is_dead(p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(p_status, '') IN (
    'CANCELED', 'CANCELLATION_IN_PROGRESS', 'VOIDED', 'VOID_PENDING', 'FUNDING_FAILED_VOIDED',
    'FUNDING_FAILED_ACTION_NEEDED', 'DISBURSEMENT_FAILED_ACTION_NEEDED', 'DISBURSEMENT_FAILED_VENDOR_BANK_REJECTED'
  );
$$;

-- Payment states where BILL has not processed the payment yet.
CREATE OR REPLACE FUNCTION ap_payment_is_pending(p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(p_status, '') IN ('SCHEDULED', 'WAITING_ON_APPROVAL', 'READY_TO_FUND');
$$;

-- Super Admin, or the bill-sync function running with the service role.
CREATE OR REPLACE FUNCTION ap_can_manage()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT is_super_admin()
      OR COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                  current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

-- ── Matching ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_refresh_pay_plans(p_bill_id text DEFAULT NULL, p_today date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst record;
  v_payment text;
  v_changed integer := 0;
BEGIN
  IF NOT ap_can_manage() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- 1. Drop matches whose payment was canceled, voided, failed or removed.
  UPDATE ap_pay_plan_installments i
  SET matched_payment_id = NULL, matched_by = NULL, bill_process_date = NULL, status = 'planned', updated_at = now()
  FROM ap_pay_plans pl
  WHERE pl.id = i.plan_id
    AND (p_bill_id IS NULL OR pl.bill_id = p_bill_id)
    AND i.matched_payment_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM ap_payments p
      JOIN ap_payment_bills pb ON pb.payment_id = p.id AND pb.bill_id = pl.bill_id
      WHERE p.id = i.matched_payment_id AND NOT ap_payment_is_dead(p.single_status)
    );

  -- 2. Match open installments, earliest first. Each payment matches one installment.
  FOR inst IN
    SELECT i.id, i.planned_date, i.amount, pl.bill_id
    FROM ap_pay_plan_installments i
    JOIN ap_pay_plans pl ON pl.id = i.plan_id
    WHERE i.matched_payment_id IS NULL
      AND (p_bill_id IS NULL OR pl.bill_id = p_bill_id)
    ORDER BY pl.bill_id, i.planned_date, i.seq
  LOOP
    SELECT p.id INTO v_payment
    FROM ap_payments p
    JOIN ap_payment_bills pb ON pb.payment_id = p.id AND pb.bill_id = inst.bill_id
    WHERE NOT ap_payment_is_dead(p.single_status)
      AND p.process_date IS NOT NULL
      AND ABS(p.process_date - inst.planned_date) <= 3
      AND ABS(pb.amount - inst.amount) <= 0.01
      AND NOT EXISTS (SELECT 1 FROM ap_pay_plan_installments o WHERE o.matched_payment_id = p.id)
    ORDER BY ABS(p.process_date - inst.planned_date), p.process_date
    LIMIT 1;

    IF v_payment IS NOT NULL THEN
      UPDATE ap_pay_plan_installments SET matched_payment_id = v_payment, matched_by = 'auto', updated_at = now()
      WHERE id = inst.id;
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  -- 3. Status and BILL's process date for every installment.
  UPDATE ap_pay_plan_installments i
  SET status = s.new_status,
      bill_process_date = s.process_date,
      updated_at = CASE WHEN i.status <> s.new_status THEN now() ELSE i.updated_at END
  FROM (
    SELECT i2.id,
           p.process_date,
           CASE
             WHEN p.id IS NOT NULL AND ap_payment_is_pending(p.single_status) THEN 'scheduled'
             WHEN p.id IS NOT NULL THEN 'paid'
             WHEN i2.planned_date + 3 < p_today THEN 'missed'
             ELSE 'planned'
           END AS new_status
    FROM ap_pay_plan_installments i2
    JOIN ap_pay_plans pl ON pl.id = i2.plan_id
    LEFT JOIN ap_payments p ON p.id = i2.matched_payment_id
    WHERE p_bill_id IS NULL OR pl.bill_id = p_bill_id
  ) s
  WHERE s.id = i.id
    AND (i.status IS DISTINCT FROM s.new_status OR i.bill_process_date IS DISTINCT FROM s.process_date);

  RETURN v_changed;
END;
$$;

-- ── Saving plans ──────────────────────────────────────────────────────────

-- Snapshot of a plan for the change log.
CREATE OR REPLACE FUNCTION ap_plan_snapshot(p_bill_id text)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan_type', pl.plan_type,
    'notes', pl.notes,
    'installments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('planned_date', i.planned_date, 'amount', i.amount, 'status', i.status) ORDER BY i.seq)
      FROM ap_pay_plan_installments i WHERE i.plan_id = pl.id), '[]'::jsonb))
  FROM ap_pay_plans pl WHERE pl.bill_id = p_bill_id;
$$;

-- p_installments: [{"planned_date": "2026-11-27", "amount": 3000.00}, ...]
-- Installments already matched to a BILL payment are kept as they are; the
-- list replaces the rest. All installments together must equal what is still
-- owed plus what matched installments have already paid.
CREATE OR REPLACE FUNCTION ap_save_pay_plan(
  p_bill_id text,
  p_plan_type text,
  p_installments jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill ap_bills;
  v_plan_id uuid;
  v_before jsonb;
  v_locked_total numeric := 0;
  v_paid_locked numeric := 0;
  v_new_total numeric := 0;
  v_expected numeric;
  v_count integer;
  v_seq integer;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_plan_type NOT IN ('full', 'weekly', 'custom', 'hold') THEN
    RAISE EXCEPTION 'Plan type must be full, weekly, custom or hold';
  END IF;

  SELECT * INTO v_bill FROM ap_bills WHERE id = p_bill_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found. Sync from BILL and try again.';
  END IF;
  IF v_bill.archived THEN
    RAISE EXCEPTION 'This bill is archived in BILL.';
  END IF;

  IF jsonb_typeof(COALESCE(p_installments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Installments must be a list';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p_installments, '[]'::jsonb)) e
    WHERE (e->>'planned_date') IS NULL OR (e->>'amount') IS NULL OR (e->>'amount')::numeric <= 0
  ) THEN
    RAISE EXCEPTION 'Every installment needs a date and an amount above zero';
  END IF;

  v_before := ap_plan_snapshot(p_bill_id);

  SELECT id INTO v_plan_id FROM ap_pay_plans WHERE bill_id = p_bill_id;
  IF v_plan_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)
      INTO v_locked_total, v_paid_locked
    FROM ap_pay_plan_installments WHERE plan_id = v_plan_id AND matched_payment_id IS NOT NULL;
  END IF;

  SELECT COALESCE(SUM((e->>'amount')::numeric), 0), COUNT(*)
    INTO v_new_total, v_count
  FROM jsonb_array_elements(COALESCE(p_installments, '[]'::jsonb)) e;

  IF p_plan_type = 'hold' THEN
    IF v_count > 0 THEN
      RAISE EXCEPTION 'A bill on hold has no installments';
    END IF;
  ELSE
    IF v_count = 0 AND v_locked_total = 0 THEN
      RAISE EXCEPTION 'Add at least one payment date';
    END IF;
    v_expected := v_bill.due_amount + v_bill.scheduled_amount + v_paid_locked;
    IF ABS((v_locked_total + v_new_total) - v_expected) > 0.01 THEN
      RAISE EXCEPTION 'Installments add up to %, but % is still owed on this bill',
        to_char(v_locked_total + v_new_total, 'FM$999,999,990.00'), to_char(v_expected, 'FM$999,999,990.00');
    END IF;
  END IF;

  IF v_plan_id IS NULL THEN
    INSERT INTO ap_pay_plans (bill_id, plan_type, notes, created_by, updated_by)
    VALUES (p_bill_id, p_plan_type, NULLIF(btrim(p_notes), ''), auth.uid(), auth.uid())
    RETURNING id INTO v_plan_id;
  ELSE
    UPDATE ap_pay_plans
    SET plan_type = p_plan_type, notes = NULLIF(btrim(p_notes), ''), updated_by = auth.uid(), updated_at = now()
    WHERE id = v_plan_id;
  END IF;

  DELETE FROM ap_pay_plan_installments WHERE plan_id = v_plan_id AND matched_payment_id IS NULL;

  SELECT COALESCE(MAX(seq), 0) INTO v_seq FROM ap_pay_plan_installments WHERE plan_id = v_plan_id;
  INSERT INTO ap_pay_plan_installments (plan_id, seq, planned_date, amount)
  SELECT v_plan_id, v_seq + row_number() OVER (ORDER BY (e->>'planned_date')::date),
         (e->>'planned_date')::date, ROUND((e->>'amount')::numeric, 2)
  FROM jsonb_array_elements(COALESCE(p_installments, '[]'::jsonb)) e;

  -- Renumber so installments read 1..n in date order.
  UPDATE ap_pay_plan_installments i SET seq = r.rn
  FROM (SELECT id, row_number() OVER (ORDER BY planned_date, seq) AS rn
        FROM ap_pay_plan_installments WHERE plan_id = v_plan_id) r
  WHERE r.id = i.id;

  PERFORM ap_refresh_pay_plans(p_bill_id);

  INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
  VALUES (p_bill_id, CASE WHEN v_before IS NULL THEN 'created' ELSE 'updated' END, v_before, ap_plan_snapshot(p_bill_id), auth.uid());

  RETURN ap_plan_snapshot(p_bill_id);
END;
$$;

CREATE OR REPLACE FUNCTION ap_delete_pay_plan(p_bill_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_before jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_before := ap_plan_snapshot(p_bill_id);
  IF v_before IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM ap_pay_plans WHERE bill_id = p_bill_id;
  INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
  VALUES (p_bill_id, 'deleted', v_before, NULL, auth.uid());
END;
$$;

-- Link a BILL payment to an installment by hand (for example one payment
-- that covers two weeks), or pass NULL to unlink.
CREATE OR REPLACE FUNCTION ap_link_installment(p_installment_id uuid, p_payment_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id text;
  v_before jsonb;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT pl.bill_id INTO v_bill_id
  FROM ap_pay_plan_installments i JOIN ap_pay_plans pl ON pl.id = i.plan_id
  WHERE i.id = p_installment_id;
  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  IF p_payment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ap_payment_bills pb JOIN ap_payments p ON p.id = pb.payment_id
    WHERE pb.payment_id = p_payment_id AND pb.bill_id = v_bill_id AND NOT ap_payment_is_dead(p.single_status)
  ) THEN
    RAISE EXCEPTION 'That payment is not an active payment on this bill';
  END IF;

  v_before := ap_plan_snapshot(v_bill_id);
  UPDATE ap_pay_plan_installments
  SET matched_payment_id = p_payment_id,
      matched_by = CASE WHEN p_payment_id IS NULL THEN NULL ELSE 'manual' END,
      updated_at = now()
  WHERE id = p_installment_id;

  PERFORM ap_refresh_pay_plans(v_bill_id);
  INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
  VALUES (v_bill_id, CASE WHEN p_payment_id IS NULL THEN 'unlinked payment' ELSE 'linked payment' END,
          v_before, ap_plan_snapshot(v_bill_id), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION ap_save_settings(p_starting_cash numeric, p_min_cash numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO ap_settings (id, starting_cash, min_cash, updated_by, updated_at)
  VALUES (1, p_starting_cash, p_min_cash, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
  SET starting_cash = EXCLUDED.starting_cash, min_cash = EXCLUDED.min_cash,
      updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

-- ── Reading: Pay Plan page ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_pay_plan_view(p_today date DEFAULT CURRENT_DATE)
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
    'today', p_today,
    'bills', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'due_date') NULLS LAST, row->>'vendor_name')
      FROM (
        SELECT jsonb_build_object(
          'id', b.id,
          'vendor_id', b.vendor_id,
          'vendor_name', b.vendor_name,
          'invoice_number', b.invoice_number,
          'invoice_date', b.invoice_date,
          'due_date', b.due_date,
          'amount', b.amount,
          'paid_amount', b.paid_amount,
          'scheduled_amount', b.scheduled_amount,
          'due_amount', b.due_amount,
          'credit_amount', b.credit_amount,
          'still_owed', b.due_amount + b.scheduled_amount,
          'approval_status', b.approval_status,
          'plan', (
            SELECT jsonb_build_object(
              'plan_type', pl.plan_type,
              'notes', pl.notes,
              'updated_at', pl.updated_at,
              'installments', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', i.id, 'seq', i.seq, 'planned_date', i.planned_date, 'amount', i.amount,
                  'status', i.status, 'matched_payment_id', i.matched_payment_id, 'matched_by', i.matched_by,
                  'bill_process_date', i.bill_process_date) ORDER BY i.seq)
                FROM ap_pay_plan_installments i WHERE i.plan_id = pl.id), '[]'::jsonb),
              -- Plan total should equal what is still owed plus what matched installments already paid.
              'review_reasons', to_jsonb(array_remove(ARRAY[
                CASE WHEN pl.plan_type <> 'hold' AND ABS(
                       COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id), 0)
                       - (b.due_amount + b.scheduled_amount
                          + COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id AND status = 'paid'), 0))
                     ) > 0.01
                     THEN 'The bill''s balance in BILL no longer matches this plan' END,
                CASE WHEN EXISTS (
                       SELECT 1 FROM ap_payment_bills pb JOIN ap_payments p ON p.id = pb.payment_id
                       WHERE pb.bill_id = b.id AND NOT ap_payment_is_dead(p.single_status)
                         AND COALESCE(p.created_time, p.updated_time, now()) >= pl.created_at - interval '1 day'
                         AND NOT EXISTS (SELECT 1 FROM ap_pay_plan_installments i WHERE i.matched_payment_id = p.id))
                     THEN 'A payment on this bill does not match any installment' END
              ], NULL))
            )
            FROM ap_pay_plans pl WHERE pl.bill_id = b.id
          ),
          'payments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', p.id, 'process_date', p.process_date, 'amount', pb.amount,
                     'status', p.single_status,
                     'linked', EXISTS (SELECT 1 FROM ap_pay_plan_installments i WHERE i.matched_payment_id = p.id))
                   ORDER BY p.process_date)
            FROM ap_payment_bills pb JOIN ap_payments p ON p.id = pb.payment_id
            WHERE pb.bill_id = b.id AND NOT ap_payment_is_dead(p.single_status)), '[]'::jsonb)
        ) AS row
        FROM ap_bills b
        WHERE NOT b.archived
          AND (b.due_amount + b.scheduled_amount > 0
               OR EXISTS (SELECT 1 FROM ap_pay_plans pl JOIN ap_pay_plan_installments i ON i.plan_id = pl.id
                          WHERE pl.bill_id = b.id AND i.planned_date >= p_today - 30))
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

-- ── Reading: Forecast page ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_forecast(p_today date DEFAULT CURRENT_DATE, p_weeks integer DEFAULT 13)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('week', p_today)::date;  -- Monday
  v_end date := (date_trunc('week', p_today) + (p_weeks * interval '1 week') - interval '1 day')::date;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (
    WITH
    open_bills AS (
      SELECT b.*, pl.id AS plan_id, pl.plan_type
      FROM ap_bills b
      LEFT JOIN ap_pay_plans pl ON pl.bill_id = b.id
      WHERE NOT b.archived
    ),
    -- Every expected cash-out, by the date the plan says it will happen.
    planned_items AS (
      -- Payments in BILL from today on (already scheduled or processing).
      SELECT 'scheduled'::text AS source, p.process_date AS item_date, pb.amount, b.id AS bill_id,
             b.vendor_name, b.invoice_number, b.due_date, p.id AS payment_id, NULL::uuid AS installment_id,
             p.single_status AS status
      FROM ap_payments p
      JOIN ap_payment_bills pb ON pb.payment_id = p.id
      LEFT JOIN ap_bills b ON b.id = pb.bill_id
      WHERE NOT ap_payment_is_dead(p.single_status)
        AND p.process_date BETWEEN p_today AND v_end
      UNION ALL
      -- Installments planned in the tracker but not in BILL yet. Missed ones are still owed: show them today.
      SELECT 'planned', GREATEST(i.planned_date, p_today),
             i.amount, b.id, b.vendor_name, b.invoice_number, b.due_date, NULL, i.id, i.status
      FROM ap_pay_plan_installments i
      JOIN ap_pay_plans pl ON pl.id = i.plan_id
      JOIN open_bills b ON b.id = pl.bill_id
      WHERE i.matched_payment_id IS NULL
      UNION ALL
      -- Bills with no plan: what is left to schedule, on the due date (past due shows today).
      SELECT 'unplanned', GREATEST(b.due_date, p_today), b.due_amount, b.id, b.vendor_name, b.invoice_number,
             b.due_date, NULL, NULL, CASE WHEN b.due_date < p_today THEN 'past_due' ELSE 'due' END
      FROM open_bills b
      WHERE b.plan_id IS NULL AND b.due_amount > 0 AND b.due_date IS NOT NULL
    ),
    -- The same money placed on due dates instead, for comparison.
    due_items AS (
      SELECT GREATEST(b.due_date, p_today) AS item_date, b.due_amount + b.scheduled_amount AS amount
      FROM open_bills b
      WHERE b.due_amount + b.scheduled_amount > 0 AND b.due_date IS NOT NULL
    ),
    weeks AS (
      SELECT gs::date AS week_start, (gs + interval '6 days')::date AS week_end, row_number() OVER (ORDER BY gs) AS n
      FROM generate_series(v_start, v_end, interval '1 week') gs
    ),
    settings AS (SELECT starting_cash, min_cash FROM ap_settings WHERE id = 1),
    week_rows AS (
      SELECT w.n, w.week_start, w.week_end,
        COALESCE((SELECT SUM(amount) FROM planned_items pi WHERE pi.source = 'scheduled' AND pi.item_date BETWEEN w.week_start AND w.week_end), 0) AS scheduled,
        COALESCE((SELECT SUM(amount) FROM planned_items pi WHERE pi.source = 'planned' AND pi.item_date BETWEEN w.week_start AND w.week_end), 0) AS planned,
        COALESCE((SELECT SUM(amount) FROM planned_items pi WHERE pi.source = 'unplanned' AND pi.item_date BETWEEN w.week_start AND w.week_end), 0) AS unplanned,
        COALESCE((SELECT SUM(amount) FROM due_items di WHERE di.item_date BETWEEN w.week_start AND w.week_end), 0) AS by_due_date
      FROM weeks w
    ),
    week_running AS (
      SELECT wr.*,
             wr.scheduled + wr.planned + wr.unplanned AS total,
             SUM(wr.scheduled + wr.planned + wr.unplanned) OVER (ORDER BY wr.n) AS cumulative,
             SUM(wr.by_due_date) OVER (ORDER BY wr.n) AS cumulative_by_due_date
      FROM week_rows wr
    ),
    late AS (
      SELECT COALESCE(SUM(i.amount), 0) AS amount,
             CASE WHEN SUM(i.amount) > 0
                  THEN ROUND(SUM(i.amount * (COALESCE(i.bill_process_date, i.planned_date) - b.due_date)) / SUM(i.amount), 1)
                  ELSE 0 END AS weighted_days
      FROM ap_pay_plan_installments i
      JOIN ap_pay_plans pl ON pl.id = i.plan_id
      JOIN open_bills b ON b.id = pl.bill_id
      WHERE i.status IN ('planned', 'scheduled', 'missed') AND COALESCE(i.bill_process_date, i.planned_date) > b.due_date
    ),
    aging AS (
      SELECT b.vendor_id, MAX(b.vendor_name) AS vendor_name,
        SUM(CASE WHEN b.due_date IS NULL OR b.due_date >= p_today THEN b.due_amount + b.scheduled_amount ELSE 0 END) AS current,
        SUM(CASE WHEN p_today - b.due_date BETWEEN 1 AND 30 THEN b.due_amount + b.scheduled_amount ELSE 0 END) AS d1_30,
        SUM(CASE WHEN p_today - b.due_date BETWEEN 31 AND 60 THEN b.due_amount + b.scheduled_amount ELSE 0 END) AS d31_60,
        SUM(CASE WHEN p_today - b.due_date BETWEEN 61 AND 90 THEN b.due_amount + b.scheduled_amount ELSE 0 END) AS d61_90,
        SUM(CASE WHEN p_today - b.due_date > 90 THEN b.due_amount + b.scheduled_amount ELSE 0 END) AS d90_plus,
        SUM(b.due_amount + b.scheduled_amount) AS total
      FROM open_bills b
      WHERE b.due_amount + b.scheduled_amount > 0
      GROUP BY b.vendor_id
    )
    SELECT jsonb_build_object(
      'today', p_today,
      'window', jsonb_build_object('start', v_start, 'end', v_end),
      'kpis', jsonb_build_object(
        'open_ap', (SELECT COALESCE(SUM(due_amount + scheduled_amount), 0) FROM open_bills),
        'past_due', (SELECT COALESCE(SUM(due_amount + scheduled_amount), 0) FROM open_bills WHERE due_date < p_today),
        'next_7', (SELECT COALESCE(SUM(amount), 0) FROM planned_items WHERE item_date BETWEEN p_today AND p_today + 6),
        'next_30', (SELECT COALESCE(SUM(amount), 0) FROM planned_items WHERE item_date BETWEEN p_today AND p_today + 29),
        'next_90', (SELECT COALESCE(SUM(amount), 0) FROM planned_items WHERE item_date BETWEEN p_today AND p_today + 89),
        'due_not_planned', (SELECT COALESCE(SUM(due_amount), 0) FROM open_bills WHERE plan_id IS NULL AND due_amount > 0),
        'on_hold', (SELECT COALESCE(SUM(due_amount + scheduled_amount), 0) FROM open_bills WHERE plan_type = 'hold'),
        'later_than_window', (SELECT COALESCE(SUM(due_amount), 0) FROM open_bills WHERE plan_id IS NULL AND due_amount > 0 AND due_date > v_end),
        'planned_after_due', (SELECT amount FROM late),
        'average_days_late', (SELECT weighted_days FROM late)
      ),
      'settings', (SELECT to_jsonb(s) FROM settings s),
      'weeks', (
        SELECT jsonb_agg(jsonb_build_object(
          'week_start', wr.week_start, 'week_end', wr.week_end,
          'scheduled', wr.scheduled, 'planned', wr.planned, 'unplanned', wr.unplanned, 'total', wr.total,
          'by_due_date', wr.by_due_date, 'cumulative', wr.cumulative, 'cumulative_by_due_date', wr.cumulative_by_due_date,
          'cash_after', CASE WHEN s.starting_cash IS NULL THEN NULL ELSE s.starting_cash - wr.cumulative END,
          'below_minimum', CASE WHEN s.starting_cash IS NULL OR s.min_cash IS NULL THEN false
                                ELSE s.starting_cash - wr.cumulative < s.min_cash END
        ) ORDER BY wr.n)
        FROM week_running wr LEFT JOIN settings s ON true
      ),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('source', source, 'date', item_date, 'amount', amount, 'bill_id', bill_id,
                 'vendor_name', vendor_name, 'invoice_number', invoice_number, 'due_date', due_date,
                 'payment_id', payment_id, 'installment_id', installment_id, 'status', status)
               ORDER BY item_date, vendor_name)
        FROM planned_items), '[]'::jsonb),
      'aging', jsonb_build_object(
        'totals', (SELECT jsonb_build_object('current', COALESCE(SUM(current), 0), 'd1_30', COALESCE(SUM(d1_30), 0),
                     'd31_60', COALESCE(SUM(d31_60), 0), 'd61_90', COALESCE(SUM(d61_90), 0),
                     'd90_plus', COALESCE(SUM(d90_plus), 0), 'total', COALESCE(SUM(total), 0)) FROM aging),
        'vendors', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.total DESC) FROM (SELECT * FROM aging ORDER BY total DESC LIMIT 30) a), '[]'::jsonb)
      ),
      'approvals', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('bill_id', b.id, 'vendor_name', b.vendor_name, 'invoice_number', b.invoice_number,
                 'amount', b.amount, 'due_date', b.due_date, 'approval_status', b.approval_status,
                 'days_waiting', p_today - b.created_time::date) ORDER BY b.created_time)
        FROM open_bills b
        WHERE b.approval_status IN ('WAITING', 'VIEWED', 'REROUTED', 'UPCOMING', 'STALE')), '[]'::jsonb),
      'exceptions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'vendor_name', p.vendor_name, 'amount', p.amount,
                 'process_date', p.process_date, 'status', p.single_status, 'updated_time', p.updated_time)
               ORDER BY p.updated_time DESC NULLS LAST)
        FROM ap_payments p
        WHERE COALESCE(p.single_status, '') IN (
            'DISBURSEMENT_FAILED_ACTION_NEEDED', 'DISBURSEMENT_FAILED_VENDOR_BANK_REJECTED', 'FUNDING_FAILED_ACTION_NEEDED',
            'FUNDING_FAILED_VOIDED', 'DISBURSEMENT_ON_HOLD', 'DISBURSEMENT_ON_HOLD_PAYER_IN_REVIEW', 'FUNDING_ON_HOLD',
            'VOIDED', 'VOID_PENDING', 'CANCELED', 'EXPIRING', 'FUNDS_ESCHEATED')
          AND COALESCE(p.updated_time::date, p.process_date) >= p_today - 60), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ap_refresh_pay_plans(text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION ap_save_pay_plan(text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_delete_pay_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_link_installment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_save_settings(numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_pay_plan_view(date) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_forecast(date, integer) TO authenticated;
