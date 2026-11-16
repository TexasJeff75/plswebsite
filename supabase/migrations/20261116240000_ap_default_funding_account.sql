/*
  # BILL Payables Monitor: default bank account for releases

  ap_settings.default_funding_account_id is the BILL bank account the release
  dialog selects first. Set it from the dialog with "Make default".

  ap_pay_plan_view(): each payment also returns before_plan, so payments made
  before a plan was created are not listed under "Needs attention".
*/

ALTER TABLE ap_settings ADD COLUMN IF NOT EXISTS default_funding_account_id text;

CREATE OR REPLACE FUNCTION ap_set_default_funding_account(p_funding_account_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO ap_settings (id, default_funding_account_id, updated_by, updated_at)
  VALUES (1, NULLIF(btrim(p_funding_account_id), ''), auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
  SET default_funding_account_id = EXCLUDED.default_funding_account_id,
      updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION ap_set_default_funding_account(text) TO authenticated;

-- Same as the payment release version, plus before_plan on each payment.
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
                     'linked', EXISTS (SELECT 1 FROM ap_pay_plan_installments i WHERE i.matched_payment_id = p.id),
                     -- Made before the plan existed, so it was never part of the plan.
                     'before_plan', EXISTS (SELECT 1 FROM ap_pay_plans pl WHERE pl.bill_id = b.id
                                              AND COALESCE(p.created_time, p.updated_time, now()) < pl.created_at - interval '1 day'))
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
