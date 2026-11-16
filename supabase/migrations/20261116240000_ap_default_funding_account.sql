/*
  # BILL Payables Monitor: default bank account for releases

  ap_settings.default_funding_account_id is the BILL bank account the release
  dialog selects first. Set it from the dialog with "Make default".
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
