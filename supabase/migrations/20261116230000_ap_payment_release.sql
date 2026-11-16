/*
  # BILL Payables Monitor (Phase 5): weekly release to BILL

  The bill-pay edge function (separate full-access BILL app) turns planned
  installments into scheduled payments in BILL, one week at a time, and can
  cancel them while BILL has not started processing.

  - ap_pay_plan_installments.matched_by gains 'release' (payment created by the tracker)
  - ap_payment_actions: every release and cancel, who, when, amount, BILL payment ID, result
  - ap_claim_release(): locks an installment for release and hands out a unique
    BILL transaction number; an attempt whose outcome was unknown is reused so a
    retry finds the original payment instead of creating a second one
  - ap_pay_plan_view(): installments also return BILL's payment status and the
    last release problem
*/

ALTER TABLE ap_pay_plan_installments DROP CONSTRAINT IF EXISTS ap_pay_plan_installments_matched_by_check;
ALTER TABLE ap_pay_plan_installments ADD CONSTRAINT ap_pay_plan_installments_matched_by_check
  CHECK (matched_by IN ('auto', 'manual', 'release'));

CREATE TABLE IF NOT EXISTS ap_payment_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('release', 'cancel')),
  installment_id uuid REFERENCES ap_pay_plan_installments(id) ON DELETE SET NULL,
  bill_id text,
  vendor_name text,
  amount numeric(14,2),
  process_date date,
  funding_account_id text,
  transaction_number text UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'unknown')),
  bill_payment_id text,
  bill_status text,
  error text,
  requested_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ap_payment_actions_installment ON ap_payment_actions(installment_id, created_at DESC);

ALTER TABLE ap_payment_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admin can read" ON ap_payment_actions;
CREATE POLICY "Super Admin can read" ON ap_payment_actions FOR SELECT TO authenticated USING (is_super_admin());

CREATE OR REPLACE FUNCTION ap_claim_release(
  p_installment_id uuid,
  p_requested_by uuid,
  p_funding_account_id text,
  p_process_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst ap_pay_plan_installments;
  v_bill_id text;
  v_vendor text;
  v_action ap_payment_actions;
  v_attempt integer;
BEGIN
  IF NOT ap_can_manage() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_inst FROM ap_pay_plan_installments WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installment not found';
  END IF;
  IF v_inst.matched_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already in BILL';
  END IF;
  SELECT pl.bill_id, b.vendor_name INTO v_bill_id, v_vendor
  FROM ap_pay_plans pl JOIN ap_bills b ON b.id = pl.bill_id WHERE pl.id = v_inst.plan_id;

  IF EXISTS (SELECT 1 FROM ap_payment_actions
             WHERE installment_id = p_installment_id AND action = 'release' AND status = 'pending'
               AND created_at > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'This payment is already being released';
  END IF;

  -- Reuse an attempt that never got an answer from BILL, keeping its transaction number.
  SELECT * INTO v_action FROM ap_payment_actions
  WHERE installment_id = p_installment_id AND action = 'release' AND status IN ('unknown', 'pending')
  ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    UPDATE ap_payment_actions
    SET status = 'pending', funding_account_id = p_funding_account_id, process_date = p_process_date,
        amount = v_inst.amount, requested_by = p_requested_by, error = NULL, finished_at = NULL
    WHERE id = v_action.id;
    RETURN jsonb_build_object('action_id', v_action.id, 'transaction_number', v_action.transaction_number);
  END IF;

  SELECT COUNT(*) + 1 INTO v_attempt FROM ap_payment_actions WHERE installment_id = p_installment_id AND action = 'release';
  INSERT INTO ap_payment_actions (action, installment_id, bill_id, vendor_name, amount, process_date, funding_account_id,
                                  transaction_number, status, requested_by)
  VALUES ('release', p_installment_id, v_bill_id, v_vendor, v_inst.amount, p_process_date, p_funding_account_id,
          'TRK-' || replace(p_installment_id::text, '-', '') || '-' || v_attempt, 'pending', p_requested_by)
  RETURNING * INTO v_action;

  RETURN jsonb_build_object('action_id', v_action.id, 'transaction_number', v_action.transaction_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION ap_claim_release(uuid, uuid, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ap_claim_release(uuid, uuid, text, date) TO service_role;
GRANT SELECT ON ap_payment_actions TO authenticated;

-- Same as Phase 2, plus payment_status and release_problem on each installment.
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
                  'bill_process_date', i.bill_process_date,
                  'payment_status', (SELECT p.single_status FROM ap_payments p WHERE p.id = i.matched_payment_id),
                  'release_problem', (SELECT a.error FROM ap_payment_actions a
                                      WHERE a.installment_id = i.id AND a.action = 'release' AND a.status IN ('failed', 'unknown')
                                        AND i.matched_payment_id IS NULL
                                      ORDER BY a.created_at DESC LIMIT 1)) ORDER BY i.seq)
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
