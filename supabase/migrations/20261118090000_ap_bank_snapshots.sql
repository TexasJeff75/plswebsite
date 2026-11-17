/*
  # BILL Payables Monitor: daily bank snapshot for the Bank tab

  ap_bank_snapshots holds one snapshot of the operating bank account per
  daily bank update: balance, money in and out by month, weekly money out,
  spending by type, top payees and recurring charges. The daily update sends
  it through the cash-import function (service role). Super Admin can read.
  Snapshots older than 90 days are removed when a new one is saved.

  ap_bank_snapshot_latest(account_last4): the newest snapshot for an account.
*/

CREATE TABLE IF NOT EXISTS ap_bank_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_last4 text NOT NULL CHECK (account_last4 ~ '^[0-9]{4}$'),
  taken_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_ap_bank_snapshots_latest ON ap_bank_snapshots(account_last4, taken_at DESC);

ALTER TABLE ap_bank_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super Admin can read" ON ap_bank_snapshots;
CREATE POLICY "Super Admin can read" ON ap_bank_snapshots FOR SELECT TO authenticated USING (is_super_admin());
GRANT SELECT ON ap_bank_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION ap_bank_snapshot_latest(p_account_last4 text DEFAULT '5761')
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
  RETURN (SELECT jsonb_build_object('taken_at', s.taken_at, 'account_last4', s.account_last4, 'data', s.data)
          FROM ap_bank_snapshots s WHERE s.account_last4 = p_account_last4
          ORDER BY s.taken_at DESC LIMIT 1);
END;
$$;

GRANT EXECUTE ON FUNCTION ap_bank_snapshot_latest(text) TO authenticated;
