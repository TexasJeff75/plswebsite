/*
  # BILL Payables Monitor (Phase 4): email alerts

  After each completed sync, bill-sync emails Super Admins one summary of
  new problems. Each problem is emailed once.

  ## Alerts
  - Failed or held payments: payment status shows a failure, hold, expiry or
    escheat, updated in the last 14 days (so the first run does not email
    old history). Alerted again if the status changes.
  - Stale approvals: bill waiting on approval for more than 7 days.
  - Missed installments: a Pay Plan installment marked missed.

  ## Objects
  - ap_alerts_sent: one row per alert already emailed
  - ap_pending_alerts(today, approval_days): recipients and new alerts
  - ap_mark_alerts_sent(keys): record alerts as emailed
*/

CREATE TABLE IF NOT EXISTS ap_alerts_sent (
  alert_key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('payment', 'approval', 'missed')),
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ap_alerts_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admin can read" ON ap_alerts_sent;
CREATE POLICY "Super Admin can read" ON ap_alerts_sent FOR SELECT TO authenticated USING (is_super_admin());

CREATE OR REPLACE FUNCTION ap_pending_alerts(p_today date DEFAULT CURRENT_DATE, p_approval_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT ap_can_manage() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'recipients', COALESCE((
      SELECT jsonb_agg(DISTINCT u.email)
      FROM user_roles r JOIN auth.users u ON u.id = r.user_id
      WHERE r.role = 'Super Admin' AND u.email IS NOT NULL), '[]'::jsonb),

    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', 'payment:' || p.id || ':' || p.single_status,
        'payment_id', p.id, 'vendor_name', p.vendor_name, 'amount', p.amount,
        'process_date', p.process_date, 'status', p.single_status) ORDER BY p.updated_time DESC NULLS LAST)
      FROM ap_payments p
      WHERE p.single_status IN (
          'DISBURSEMENT_FAILED_ACTION_NEEDED', 'DISBURSEMENT_FAILED_VENDOR_BANK_REJECTED',
          'FUNDING_FAILED_ACTION_NEEDED', 'FUNDING_FAILED_VOIDED',
          'DISBURSEMENT_ON_HOLD', 'DISBURSEMENT_ON_HOLD_PAYER_IN_REVIEW', 'FUNDING_ON_HOLD',
          'EXPIRING', 'FUNDS_ESCHEATED')
        AND COALESCE(p.updated_time::date, p.process_date) >= p_today - 14
        AND NOT EXISTS (SELECT 1 FROM ap_alerts_sent s WHERE s.alert_key = 'payment:' || p.id || ':' || p.single_status)
    ), '[]'::jsonb),

    'approvals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', 'approval:' || b.id,
        'bill_id', b.id, 'vendor_name', b.vendor_name, 'invoice_number', b.invoice_number,
        'amount', b.amount, 'due_date', b.due_date, 'approval_status', b.approval_status,
        'days_waiting', p_today - b.created_time::date) ORDER BY b.created_time)
      FROM ap_bills b
      WHERE NOT b.archived
        AND b.approval_status IN ('WAITING', 'VIEWED', 'REROUTED', 'UPCOMING', 'STALE')
        AND b.created_time::date < p_today - p_approval_days
        AND NOT EXISTS (SELECT 1 FROM ap_alerts_sent s WHERE s.alert_key = 'approval:' || b.id)
    ), '[]'::jsonb),

    'missed', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', 'missed:' || i.id,
        'installment_id', i.id, 'vendor_name', b.vendor_name, 'invoice_number', b.invoice_number,
        'amount', i.amount, 'planned_date', i.planned_date, 'seq', i.seq,
        'of', (SELECT COUNT(*) FROM ap_pay_plan_installments x WHERE x.plan_id = i.plan_id)) ORDER BY i.planned_date)
      FROM ap_pay_plan_installments i
      JOIN ap_pay_plans pl ON pl.id = i.plan_id
      JOIN ap_bills b ON b.id = pl.bill_id
      WHERE i.status = 'missed' AND NOT b.archived
        AND NOT EXISTS (SELECT 1 FROM ap_alerts_sent s WHERE s.alert_key = 'missed:' || i.id)
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION ap_mark_alerts_sent(p_keys text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT ap_can_manage() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO ap_alerts_sent (alert_key, kind)
  SELECT k, split_part(k, ':', 1) FROM unnest(p_keys) AS k
  WHERE split_part(k, ':', 1) IN ('payment', 'approval', 'missed')
  ON CONFLICT (alert_key) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Clearing BILL data (sandbox to production) also clears sent alerts.
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
           ap_sync_state, ap_sync_runs, ap_alerts_sent;

  UPDATE ap_settings SET data_source_env = NULL, updated_by = auth.uid(), updated_at = now() WHERE id = 1;

  RETURN jsonb_build_object('bills_removed', v_bills, 'plans_removed', v_plans);
END;
$$;

GRANT EXECUTE ON FUNCTION ap_pending_alerts(date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION ap_mark_alerts_sent(text[]) TO service_role;
