/*
  # BILL Payables Monitor: weekly cash flow

  A week-by-week cash flow grid (weeks start on Sunday), like a cash flow
  spreadsheet:
    beginning balance + cash in - cash out = ending balance
  The next week begins with this week's actual ending when one is entered,
  otherwise with the forecast ending.

  - ap_cash_lines / ap_cash_amounts: lines typed in by hand (cash collected,
    payroll, rent, loans...) and their weekly amounts. Amounts are positive;
    the line's direction says whether it is money in or out.
  - ap_cash_actuals: the actual ending bank balance for a week.
  - ap_vendor_groups: shows a BILL vendor under "People" or "Vendors".
  - ap_settings.starting_cash_week: the week starting_cash is the beginning
    balance of. Weeks before it show data but no running balance.
  - ap_cash_flow(from, to): everything the grid needs. Vendor payments come
    from BILL and the Pay Plan: paid, scheduled in BILL, and planned
    installments not yet in BILL (overdue ones count in the current week).
    Open bills with no plan are listed separately and are not counted.
*/

ALTER TABLE ap_settings ADD COLUMN IF NOT EXISTS starting_cash_week date;

CREATE OR REPLACE FUNCTION ap_week_start(p_day date)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $$ SELECT p_day - EXTRACT(DOW FROM p_day)::int $$;

CREATE TABLE IF NOT EXISTS ap_cash_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_cash_amounts (
  line_id uuid NOT NULL REFERENCES ap_cash_lines(id) ON DELETE CASCADE,
  week_start date NOT NULL CHECK (EXTRACT(DOW FROM week_start) = 0),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (line_id, week_start)
);

CREATE TABLE IF NOT EXISTS ap_cash_actuals (
  week_start date PRIMARY KEY CHECK (EXTRACT(DOW FROM week_start) = 0),
  actual_ending numeric(14,2) NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ap_vendor_groups (
  vendor_id text PRIMARY KEY,
  grp text NOT NULL CHECK (grp IN ('people', 'vendors')),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ap_cash_lines','ap_cash_amounts','ap_cash_actuals','ap_vendor_groups']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super Admin can read" ON %I', t);
    EXECUTE format('CREATE POLICY "Super Admin can read" ON %I FOR SELECT TO authenticated USING (is_super_admin())', t);
    EXECUTE format('GRANT SELECT ON %I TO authenticated', t);
  END LOOP;
END $$;

-- Starter lines (names only), added once.
INSERT INTO ap_cash_lines (name, direction, sort_order)
SELECT v.name, v.direction, v.sort_order
FROM (VALUES
  ('Cash Collected', 'in', 10), ('Other Cash', 'in', 20),
  ('Payroll', 'out', 10), ('BCBSTX', 'out', 20), ('Rent', 'out', 30),
  ('QB Term Loan', 'out', 40), ('TrustMark Loan', 'out', 50), ('Electric', 'out', 60),
  ('Credit Card', 'out', 70), ('Amazon', 'out', 80)
) AS v(name, direction, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM ap_cash_lines);

-- ── Writes (Super Admin only) ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_save_cash_line(p_id uuid, p_name text, p_direction text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Choose money in or money out';
  END IF;
  IF length(btrim(COALESCE(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'Give the line a name';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO ap_cash_lines (name, direction, sort_order, created_by)
    VALUES (btrim(p_name), p_direction,
            COALESCE((SELECT MAX(sort_order) FROM ap_cash_lines WHERE direction = p_direction), 0) + 10, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE ap_cash_lines SET name = btrim(p_name), direction = p_direction WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Line not found';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION ap_delete_cash_line(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM ap_cash_lines WHERE id = p_id;
END;
$$;

-- p_amounts: [{ "week_start": "2026-11-15", "amount": 1234.56 }, ...]. An amount
-- of 0 or null clears that week. Any date is moved to its week's Sunday.
CREATE OR REPLACE FUNCTION ap_set_cash_amounts(p_line_id uuid, p_amounts jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE e jsonb; v_week date; v_amount numeric;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ap_cash_lines WHERE id = p_line_id) THEN
    RAISE EXCEPTION 'Line not found';
  END IF;
  IF jsonb_typeof(p_amounts) <> 'array' OR jsonb_array_length(p_amounts) > 200 THEN
    RAISE EXCEPTION 'Send a list of up to 200 weeks';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_amounts)
  LOOP
    v_week := ap_week_start((e->>'week_start')::date);
    v_amount := ROUND(ABS(COALESCE(NULLIF(e->>'amount', '')::numeric, 0)), 2);
    IF v_amount = 0 THEN
      DELETE FROM ap_cash_amounts WHERE line_id = p_line_id AND week_start = v_week;
    ELSE
      INSERT INTO ap_cash_amounts (line_id, week_start, amount, updated_by, updated_at)
      VALUES (p_line_id, v_week, v_amount, auth.uid(), now())
      ON CONFLICT (line_id, week_start) DO UPDATE
        SET amount = EXCLUDED.amount, updated_by = EXCLUDED.updated_by, updated_at = now();
    END IF;
  END LOOP;
END;
$$;

-- p_amount null clears the actual for that week.
CREATE OR REPLACE FUNCTION ap_set_cash_actual(p_week date, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_amount IS NULL THEN
    DELETE FROM ap_cash_actuals WHERE week_start = ap_week_start(p_week);
  ELSE
    INSERT INTO ap_cash_actuals (week_start, actual_ending, updated_by, updated_at)
    VALUES (ap_week_start(p_week), ROUND(p_amount, 2), auth.uid(), now())
    ON CONFLICT (week_start) DO UPDATE
      SET actual_ending = EXCLUDED.actual_ending, updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION ap_set_cash_start(p_amount numeric, p_week date, p_min_cash numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO ap_settings (id, starting_cash, starting_cash_week, min_cash, updated_by, updated_at)
  VALUES (1, ROUND(p_amount, 2), ap_week_start(p_week), ROUND(p_min_cash, 2), auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
    SET starting_cash = EXCLUDED.starting_cash, starting_cash_week = EXCLUDED.starting_cash_week,
        min_cash = EXCLUDED.min_cash, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

-- p_group null puts the vendor back in the default group (Vendors).
CREATE OR REPLACE FUNCTION ap_set_vendor_group(p_vendor_id text, p_group text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_group IS NULL OR p_group = 'vendors' THEN
    DELETE FROM ap_vendor_groups WHERE vendor_id = p_vendor_id;
  ELSIF p_group = 'people' THEN
    INSERT INTO ap_vendor_groups (vendor_id, grp, updated_by, updated_at)
    VALUES (p_vendor_id, 'people', auth.uid(), now())
    ON CONFLICT (vendor_id) DO UPDATE SET grp = 'people', updated_by = EXCLUDED.updated_by, updated_at = now();
  ELSE
    RAISE EXCEPTION 'Group must be people or vendors';
  END IF;
END;
$$;

-- ── Read ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ap_cash_flow(p_from date, p_to date, p_today date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_today date := COALESCE(p_today, (now() AT TIME ZONE 'America/Chicago')::date);
  v_from date := ap_week_start(p_from);
  v_to date := ap_week_start(p_to);
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_to < v_from OR v_to - v_from > 7 * 104 THEN
    RAISE EXCEPTION 'Choose up to two years of weeks';
  END IF;

  RETURN jsonb_build_object(
    'today', v_today,
    'current_week', ap_week_start(v_today),
    'from', v_from,
    'to', v_to,
    'settings', (SELECT jsonb_build_object('starting_cash', s.starting_cash, 'starting_cash_week', s.starting_cash_week, 'min_cash', s.min_cash)
                 FROM ap_settings s WHERE s.id = 1),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'name', l.name, 'direction', l.direction, 'sort_order', l.sort_order,
               'amounts', COALESCE((SELECT jsonb_object_agg(a.week_start, a.amount) FROM ap_cash_amounts a
                                    WHERE a.line_id = l.id AND a.week_start BETWEEN v_from AND v_to), '{}'::jsonb))
             ORDER BY l.direction, l.sort_order, l.created_at)
      FROM ap_cash_lines l), '[]'::jsonb),
    'actuals', COALESCE((SELECT jsonb_object_agg(week_start, actual_ending) FROM ap_cash_actuals
                         WHERE week_start BETWEEN v_from AND v_to), '{}'::jsonb),
    'vendors', COALESCE((
      WITH flows AS (
        -- BILL payments: paid, or scheduled and not yet paid.
        SELECT p.vendor_id, p.vendor_name, ap_week_start(GREATEST(p.process_date, CASE WHEN ap_payment_is_pending(p.single_status) THEN v_today ELSE p.process_date END)) AS week,
               CASE WHEN ap_payment_is_pending(p.single_status) THEN 'scheduled' ELSE 'paid' END AS kind,
               p.amount
        FROM ap_payments p
        WHERE p.process_date IS NOT NULL AND NOT ap_payment_is_dead(p.single_status)
          AND (p.process_date BETWEEN v_from - 7 AND v_to + 6 OR ap_payment_is_pending(p.single_status))
        UNION ALL
        -- Planned installments not yet in BILL. Overdue ones land in the current week.
        SELECT b.vendor_id, b.vendor_name, ap_week_start(GREATEST(i.planned_date, v_today)), 'planned', i.amount
        FROM ap_pay_plan_installments i
        JOIN ap_pay_plans pl ON pl.id = i.plan_id
        JOIN ap_bills b ON b.id = pl.bill_id
        WHERE i.matched_payment_id IS NULL AND i.status IN ('planned', 'missed')
          AND pl.plan_type <> 'hold' AND NOT b.archived
      ),
      cells AS (
        SELECT vendor_id, MAX(vendor_name) AS vendor_name, week,
               jsonb_object_agg(kind, total) AS amounts
        FROM (SELECT vendor_id, vendor_name, week, kind, SUM(amount) AS total
              FROM flows WHERE week BETWEEN v_from AND v_to
              GROUP BY vendor_id, vendor_name, week, kind) k
        GROUP BY vendor_id, week
      )
      SELECT jsonb_agg(jsonb_build_object(
               'vendor_id', c.vendor_id,
               'vendor_name', COALESCE(v.name, c.vendor_name, 'Unknown vendor'),
               'group', COALESCE(g.grp, 'vendors'),
               'weeks', c.weeks)
             ORDER BY COALESCE(v.name, c.vendor_name))
      FROM (SELECT vendor_id, MAX(vendor_name) AS vendor_name, jsonb_object_agg(week, amounts) AS weeks
            FROM cells GROUP BY vendor_id) c
      LEFT JOIN ap_vendors v ON v.id = c.vendor_id
      LEFT JOIN ap_vendor_groups g ON g.vendor_id = c.vendor_id), '[]'::jsonb),
    -- Open bills with no plan, by due week (overdue ones in the current week). Not counted.
    'unplanned', COALESCE((
      SELECT jsonb_object_agg(week, total) FROM (
        SELECT ap_week_start(GREATEST(COALESCE(b.due_date, v_today), v_today)) AS week, SUM(b.due_amount) AS total
        FROM ap_bills b
        WHERE NOT b.archived AND b.due_amount > 0
          AND NOT EXISTS (SELECT 1 FROM ap_pay_plans pl WHERE pl.bill_id = b.id)
        GROUP BY 1) u
      WHERE week BETWEEN v_from AND v_to), '{}'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ap_week_start(date) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_save_cash_line(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_delete_cash_line(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_set_cash_amounts(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_set_cash_actual(date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_set_cash_start(numeric, date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_set_vendor_group(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ap_cash_flow(date, date, date) TO authenticated;
