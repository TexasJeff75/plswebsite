/*
  # BILL Payables Monitor: put many bills on hold or mark them for review

  - ap_bill_review_flags: bills marked "Needs review" by hand, with an optional note.
  - ap_bulk_update_bills(bill_ids, action, note): one call for many bills.
      hold          plan becomes "hold" (planned dates are removed)
      unhold        removes a hold plan
      review        marks the bill "Needs review"
      clear_review  removes that mark
    A bill is skipped, with the reason, when the action can't apply to it. A bill
    with a payment already scheduled in BILL is not put on hold: cancel it first.
  - ap_pay_plan_view(): each bill also returns review_flag.
  - ap_clear_bill_data(): also clears review flags.
*/

CREATE TABLE IF NOT EXISTS ap_bill_review_flags (
  bill_id text PRIMARY KEY,
  note text,
  flagged_by uuid REFERENCES auth.users(id),
  flagged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ap_bill_review_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admin can read" ON ap_bill_review_flags;
CREATE POLICY "Super Admin can read" ON ap_bill_review_flags FOR SELECT TO authenticated USING (is_super_admin());
GRANT SELECT ON ap_bill_review_flags TO authenticated;

CREATE OR REPLACE FUNCTION ap_bulk_update_bills(p_bill_ids text[], p_action text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_plan ap_pay_plans;
  v_updated integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_reason text;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_action NOT IN ('hold', 'unhold', 'review', 'clear_review') THEN
    RAISE EXCEPTION 'Action must be hold, unhold, review or clear_review';
  END IF;
  IF COALESCE(array_length(p_bill_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Choose at least one bill';
  END IF;
  IF array_length(p_bill_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Choose 500 bills or fewer at a time';
  END IF;

  FOREACH v_id IN ARRAY (SELECT array_agg(DISTINCT x) FROM unnest(p_bill_ids) x)
  LOOP
    v_reason := NULL;
    IF NOT EXISTS (SELECT 1 FROM ap_bills WHERE id = v_id) THEN
      v_reason := 'Bill not found. Sync from BILL and try again.';
    ELSE
      SELECT * INTO v_plan FROM ap_pay_plans WHERE bill_id = v_id;

      IF p_action = 'hold' THEN
        IF v_plan.plan_type = 'hold' THEN
          v_reason := 'Already on hold';
        ELSIF EXISTS (SELECT 1 FROM ap_pay_plan_installments i
                      WHERE i.plan_id = v_plan.id AND i.status = 'scheduled') THEN
          v_reason := 'Has a payment scheduled in BILL. Cancel it first.';
        ELSE
          BEGIN
            PERFORM ap_save_pay_plan(v_id, 'hold', '[]'::jsonb, v_plan.notes);
          EXCEPTION WHEN OTHERS THEN
            v_reason := SQLERRM;
          END;
        END IF;

      ELSIF p_action = 'unhold' THEN
        IF v_plan.id IS NULL OR v_plan.plan_type <> 'hold' THEN
          v_reason := 'Not on hold';
        ELSIF EXISTS (SELECT 1 FROM ap_pay_plan_installments i
                      WHERE i.plan_id = v_plan.id AND i.matched_payment_id IS NOT NULL) THEN
          v_reason := 'Has BILL payments linked. Open the plan to change it.';
        ELSE
          PERFORM ap_delete_pay_plan(v_id);
        END IF;

      ELSIF p_action = 'review' THEN
        INSERT INTO ap_bill_review_flags (bill_id, note, flagged_by, flagged_at)
        VALUES (v_id, NULLIF(btrim(p_note), ''), auth.uid(), now())
        ON CONFLICT (bill_id) DO UPDATE
          SET note = COALESCE(EXCLUDED.note, ap_bill_review_flags.note),
              flagged_by = EXCLUDED.flagged_by, flagged_at = now();
        INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
        VALUES (v_id, 'marked for review', NULL, jsonb_build_object('note', NULLIF(btrim(p_note), '')), auth.uid());

      ELSE -- clear_review
        DELETE FROM ap_bill_review_flags WHERE bill_id = v_id;
        IF NOT FOUND THEN
          v_reason := 'Not marked for review';
        ELSE
          INSERT INTO ap_plan_changes (bill_id, action, before, after, changed_by)
          VALUES (v_id, 'review cleared', NULL, NULL, auth.uid());
        END IF;
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      v_updated := v_updated + 1;
    ELSE
      v_skipped := v_skipped || jsonb_build_object('bill_id', v_id, 'reason', v_reason);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION ap_bulk_update_bills(text[], text, text) TO authenticated;

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

  TRUNCATE ap_pay_plan_installments, ap_pay_plans, ap_plan_changes, ap_bill_review_flags,
           ap_bill_lines, ap_payment_bills, ap_bills, ap_payments,
           ap_vendors, ap_vendor_credits, ap_classifications,
           ap_sync_state, ap_sync_runs, ap_alerts_sent;

  UPDATE ap_settings SET data_source_env = NULL, updated_by = auth.uid(), updated_at = now() WHERE id = 1;

  RETURN jsonb_build_object('bills_removed', v_bills, 'plans_removed', v_plans);
END;
$$;

-- Same as the previous version, plus review_flag on each bill.
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
