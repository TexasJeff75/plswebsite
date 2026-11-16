/*
  # BILL Payables Monitor (Phase 3): sandbox to production switch

  - ap_settings.data_source_env records which BILL environment the copied
    data came from (sandbox or production).
  - ap_record_data_source(env): called by bill-sync before each run. Returns
    'ok', or 'mismatch:<saved env>' when the connection now points at a
    different environment than the saved data, so the two never mix.
  - ap_clear_bill_data(): Super Admin only. Removes all copied BILL data and
    pay plans so a sync can start fresh. Cash cushion settings are kept.
  - ap_filter_options() now also returns data_source_env for the page badge.
*/

ALTER TABLE ap_settings ADD COLUMN IF NOT EXISTS data_source_env text
  CHECK (data_source_env IN ('sandbox', 'production'));

CREATE OR REPLACE FUNCTION ap_record_data_source(p_env text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saved text;
  v_has_data boolean;
BEGIN
  IF NOT ap_can_manage() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_env NOT IN ('sandbox', 'production') THEN
    RAISE EXCEPTION 'Environment must be sandbox or production';
  END IF;

  INSERT INTO ap_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  SELECT data_source_env INTO v_saved FROM ap_settings WHERE id = 1 FOR UPDATE;

  IF v_saved IS NULL THEN
    -- Data synced before this guard existed came from the sandbox.
    SELECT EXISTS (SELECT 1 FROM ap_bills) OR EXISTS (SELECT 1 FROM ap_vendors) INTO v_has_data;
    IF v_has_data AND p_env <> 'sandbox' THEN
      UPDATE ap_settings SET data_source_env = 'sandbox' WHERE id = 1;
      RETURN 'mismatch:sandbox';
    END IF;
    UPDATE ap_settings SET data_source_env = p_env WHERE id = 1;
    RETURN 'ok';
  END IF;

  IF v_saved <> p_env THEN
    RETURN 'mismatch:' || v_saved;
  END IF;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION ap_clear_bill_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bills integer;
  v_plans integer;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM ap_sync_runs WHERE status = 'running' AND started_at > now() - interval '15 minutes') THEN
    RAISE EXCEPTION 'A sync is running. Try again in a few minutes.';
  END IF;

  SELECT COUNT(*) INTO v_bills FROM ap_bills;
  SELECT COUNT(*) INTO v_plans FROM ap_pay_plans;

  TRUNCATE ap_pay_plan_installments, ap_pay_plans, ap_plan_changes,
           ap_bill_lines, ap_payment_bills, ap_bills, ap_payments,
           ap_vendors, ap_vendor_credits, ap_classifications,
           ap_sync_state, ap_sync_runs;

  UPDATE ap_settings SET data_source_env = NULL, updated_by = auth.uid(), updated_at = now() WHERE id = 1;

  RETURN jsonb_build_object('bills_removed', v_bills, 'plans_removed', v_plans);
END;
$$;

-- Same as Phase 1, plus data_source_env.
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
    'last_success', (SELECT MAX(finished_at) FROM ap_sync_runs WHERE status = 'succeeded'),
    'data_source_env', (SELECT data_source_env FROM ap_settings WHERE id = 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ap_record_data_source(text) TO service_role;
GRANT EXECUTE ON FUNCTION ap_clear_bill_data() TO authenticated;
