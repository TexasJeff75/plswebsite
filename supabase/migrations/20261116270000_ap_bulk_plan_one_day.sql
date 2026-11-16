/*
  # BILL Payables Monitor: plan many bills for one day

  ap_bulk_plan_bills(bill_ids, planned_date): each bill gets one planned
  payment on that date for what is still owed. Planned dates already on the
  bill are replaced; payments already linked to BILL stay as they are.
  A bill is skipped, with the reason, when nothing is left to plan, its full
  balance is already scheduled in BILL, or the plan can't be saved. Uses ap_save_pay_plan, so its checks and change log apply.
*/

CREATE OR REPLACE FUNCTION ap_bulk_plan_bills(p_bill_ids text[], p_planned_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_bill ap_bills;
  v_plan ap_pay_plans;
  v_locked numeric;
  v_paid_locked numeric;
  v_amount numeric;
  v_has_locked boolean;
  v_updated integer := 0;
  v_total numeric := 0;
  v_skipped jsonb := '[]'::jsonb;
  v_reason text;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_planned_date IS NULL THEN
    RAISE EXCEPTION 'Choose a date';
  END IF;
  IF p_planned_date < (now() AT TIME ZONE 'America/Chicago')::date THEN
    RAISE EXCEPTION 'Choose today or a later date';
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
    SELECT * INTO v_bill FROM ap_bills WHERE id = v_id;
    IF NOT FOUND THEN
      v_reason := 'Bill not found. Sync from BILL and try again.';
    ELSE
      SELECT * INTO v_plan FROM ap_pay_plans WHERE bill_id = v_id;
      SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0), COUNT(*) > 0
        INTO v_locked, v_paid_locked, v_has_locked
      FROM ap_pay_plan_installments WHERE plan_id = v_plan.id AND matched_payment_id IS NOT NULL;

      v_amount := ROUND(v_bill.due_amount + v_bill.scheduled_amount + v_paid_locked - v_locked, 2);
      IF v_amount <= 0 THEN
        v_reason := 'Nothing left to plan. It is already paid or scheduled in BILL.';
      ELSIF v_bill.due_amount <= 0 THEN
        v_reason := 'The full balance is already scheduled in BILL.';
      ELSE
        BEGIN
          PERFORM ap_save_pay_plan(
            v_id,
            CASE WHEN v_has_locked THEN 'custom' ELSE 'full' END,
            jsonb_build_array(jsonb_build_object('planned_date', p_planned_date, 'amount', v_amount)),
            v_plan.notes);
          v_total := v_total + v_amount;
        EXCEPTION WHEN OTHERS THEN
          v_reason := SQLERRM;
        END;
      END IF;
    END IF;

    IF v_reason IS NULL THEN
      v_updated := v_updated + 1;
    ELSE
      v_skipped := v_skipped || jsonb_build_object('bill_id', v_id, 'reason', v_reason);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'total', v_total, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION ap_bulk_plan_bills(text[], date) TO authenticated;
