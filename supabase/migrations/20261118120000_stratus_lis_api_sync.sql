/*
  # StratusDX LIS Integration API sync

  The import now uses only the StratusDX LIS Integration API (OAuth, date
  based). This migration supports it and tightens access:

  1. lab_orders.sync_fingerprint: a short summary of an order's status, dates
     and result counts. The sync skips an order whose summary has not changed.
  2. lab_results.sync_status now also allows 'synced' (lab_orders already does).
  3. stratus_sync_checkpoint.status_updated_from: the day the "changed orders"
     pass reads from.
  4. stratus_token_cache holds the live StratusDX access token. Until now
     proximity_admin and proximity_staff users could read it from the
     browser. Only the server (service role) can read it now.
  5. stratus_sync_checkpoint: Super Admins and proximity_admin can read it (the
     StratusDX Sync page shows it); only the server writes it.
*/

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS sync_fingerprint text;

ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_sync_status_check;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_sync_status_check
  CHECK (sync_status IN ('pending', 'retrieved', 'acknowledged', 'synced', 'error'));

ALTER TABLE stratus_sync_checkpoint ADD COLUMN IF NOT EXISTS status_updated_from date;

-- Token cache: server only. RLS stays on with no policies, so only the
-- service role (which bypasses RLS) can read or write it.
DROP POLICY IF EXISTS "Admins can manage token cache" ON stratus_token_cache;
ALTER TABLE stratus_token_cache ENABLE ROW LEVEL SECURITY;

-- Checkpoint: read only for admins; the sync writes it with the service role.
DROP POLICY IF EXISTS "Admins can manage sync checkpoint" ON stratus_sync_checkpoint;
DROP POLICY IF EXISTS "Admins can read sync checkpoint" ON stratus_sync_checkpoint;
CREATE POLICY "Admins can read sync checkpoint"
  ON stratus_sync_checkpoint FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'proximity_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_lab_orders_processed_at_utc ON lab_orders(processed_at_utc DESC);
