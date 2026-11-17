/*
  # BILL Payables Monitor: remove a payment from the plan

  - ap_remove_installment(installment_id): takes one planned payment off a
    bill's plan. Only payments not yet in BILL (planned or missed). If it was
    the last payment left on the plan, the plan is removed and the bill goes
    back to "Not planned". The change is logged in ap_plan_changes.
  - ap_pay_plan_view(): when less is planned than is owed, the review note now
    says how much has no planned date (it used to say the balance no longer
    matches, which is kept for when more is planned than owed).
*/

CREATE OR REPLACE FUNCTION ap_remove_installment(p_installment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst ap_pay_plan_installments;
  v_plan ap_pay_plans;
  v_before jsonb;
  v_left integer;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_inst FROM ap_pay_plan_installments WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found. Refresh and try again.';
  END IF;
  IF v_inst.matched_payment_id IS NOT NULL OR v_inst.status NOT IN ('planned', 'missed') THEN
    RAISE EXCEPTION 'This payment is already in BILL. Cancel it in BILL first.';
  END IF;

  SELECT * INTO v_plan FROM ap_pay_plans WHERE id = v_inst.plan_id;
  v_before := ap_plan_snapshot(v_plan.bill_id);

  DELETE FROM ap_pay_plan_installments WHERE id = p_installment_id;
  SELECT COUNT(*) INTO v_left FROM ap_pay_plan_installments WHERE plan_id = v_plan.id;

  IF v_left = 0 THEN
    DELETE FROM ap_pay_plans WHERE id = v_plan.id;
  ELSE
    UPDATE ap_pay_plan_installments i SET seq = r.rn
    FROM (SELECT id, row_number() OVER (ORDER BY planned_date, seq) AS rn
          FROM ap_pay_plan_installments WHERE plan_id = v_plan.id) r
    WHERE r.id = i.id;
    UPDATE ap_pay_plans SET plan_type = CASE WHEN plan_type = 'weekly' THEN 'custom' ELSE plan_type END,
           updated_by = auth.uid(), updated_at = now()
    WHERE id = v_plan.id;
  END IF;

  INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
  VALUES (v_plan.bill_id, 'payment removed', v_before, ap_plan_snapshot(v_plan.bill_id), auth.uid());

  RETURN jsonb_build_object('bill_id', v_plan.bill_id, 'removed_amount', v_inst.amount, 'plan_removed', v_left = 0);
END;
$$;

GRANT EXECUTE ON FUNCTION ap_remove_installment(uuid) TO authenticated;

-- Same as the previous version, with the clearer review note.
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
          'review_flag', (SELECT jsonb_build_object('note', f.note, 'flagged_at', f.flagged_at)
                          FROM ap_bill_review_flags f WHERE f.bill_id = b.id),
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
                -- Less planned than owed (for example a payment was removed from the plan).
                CASE WHEN pl.plan_type <> 'hold' AND
                       (b.due_amount + b.scheduled_amount
                        + COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id AND status = 'paid'), 0))
                       - COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id), 0) > 0.01
                     THEN to_char((b.due_amount + b.scheduled_amount
                        + COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id AND status = 'paid'), 0))
                       - COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id), 0), 'FM$999,999,990.00')
                          || ' of this bill has no planned date' END,
                -- More planned than owed (the balance in BILL went down).
                CASE WHEN pl.plan_type <> 'hold' AND
                       COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id), 0)
                       - (b.due_amount + b.scheduled_amount
                          + COALESCE((SELECT SUM(amount) FROM ap_pay_plan_installments WHERE plan_id = pl.id AND status = 'paid'), 0)) > 0.01
                     THEN 'The bill''s balance in BILL no longer matches this plan' END,
                CASE WHEN EXISTS (
                       SELECT 1 FROM ap_payment_bills pb JOIN ap_payments p ON p.id = pb.payment_id
                       WHERE pb.bill_id = b.id AND NOT ap_payment_is_dead(p.single_status)
                         AND COALESCE(p.created_time, p.updated_time, now()) >= pl.created_at - interval '1 day'
                         AND p.process_date >= (pl.created_at AT TIME ZONE 'America/Chicago')::date
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
                                              AND (p.process_date < (pl.created_at AT TIME ZONE 'America/Chicago')::date
                                                   OR COALESCE(p.created_time, p.updated_time, now()) < pl.created_at - interval '1 day')))
                   ORDER BY p.process_date)
            FROM ap_payment_bills pb JOIN ap_payments p ON p.id = pb.payment_id
            WHERE pb.bill_id = b.id AND NOT ap_payment_is_dead(p.single_status)), '[]'::jsonb)
        ) AS row
        FROM ap_bills b
        WHERE NOT b.archived
          AND (b.due_amount + b.scheduled_amount > 0
               OR EXISTS (SELECT 1 FROM ap_bill_review_flags f WHERE f.bill_id = b.id)
               OR EXISTS (SELECT 1 FROM ap_pay_plans pl JOIN ap_pay_plan_installments i ON i.plan_id = pl.id
                          WHERE pl.bill_id = b.id AND i.planned_date >= p_today - 30))
      ) x
    ), '[]'::jsonb)
  );
END;
$$;
