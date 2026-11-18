/*
  # StratusDX weekly re-check: which orders to re-read

  The sync re-reads, at most once a week (not read since p_read_before):
  - orders still Pending or Pending Received after they were ordered more
    than 14 days ago (p_pending_before, a StratusDX compact date), in case
    received/finalized dates were filled in later;
  - Final orders with no results saved, in case results were added later
    (StratusDX had none for most orders finalized from September 2026).

  Oldest read first. Only the server (service role) may call these.
*/

CREATE OR REPLACE FUNCTION stratus_recheck_candidates(p_pending_before text, p_read_before timestamptz, p_limit int)
RETURNS TABLE (id uuid, stratus_guid text, organization_id uuid, facility_id uuid, lab_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT lo.id, lo.stratus_guid, lo.organization_id, lo.facility_id, lo.lab_status
    FROM lab_orders lo
    WHERE lo.sync_status = 'synced'
      AND (lo.retrieved_at IS NULL OR lo.retrieved_at < p_read_before)
      AND (
        (lo.lab_status IN ('Pending', 'Pending Received') AND lo.requisition_datetime < p_pending_before)
        OR (lo.lab_status = 'Final'
            AND NOT EXISTS (SELECT 1 FROM stratus_result_observations o WHERE o.lab_order_id = lo.id))
      )
    ORDER BY lo.retrieved_at NULLS FIRST
    LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION stratus_recheck_waiting(p_pending_before text, p_read_before timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)
    FROM lab_orders lo
    WHERE lo.sync_status = 'synced'
      AND (lo.retrieved_at IS NULL OR lo.retrieved_at < p_read_before)
      AND (
        (lo.lab_status IN ('Pending', 'Pending Received') AND lo.requisition_datetime < p_pending_before)
        OR (lo.lab_status = 'Final'
            AND NOT EXISTS (SELECT 1 FROM stratus_result_observations o WHERE o.lab_order_id = lo.id))
      );
$$;

REVOKE EXECUTE ON FUNCTION stratus_recheck_candidates(text, timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION stratus_recheck_waiting(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stratus_recheck_candidates(text, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION stratus_recheck_waiting(text, timestamptz) TO service_role;

CREATE INDEX IF NOT EXISTS idx_lab_orders_retrieved_at ON lab_orders(retrieved_at);
