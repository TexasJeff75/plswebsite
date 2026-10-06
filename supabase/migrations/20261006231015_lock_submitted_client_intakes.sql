/*
# Lock Submitted Client Intakes

## Summary
Prevents a public share-link holder from reopening or changing an intake after
it has been submitted. The browser already switches to a confirmation screen,
but this migration enforces the same rule inside the database function so direct
bot requests cannot bypass the interface.

## Modified Function
- `save_public_client_intake`: accepts public saves and submissions only while
  the intake status is `draft`; submitted and converted records are immutable
  through the public link.

## Security Changes
- Closes the direct-request path that could revert a submitted intake to draft.
- Keeps expiry checks and the existing narrowly scoped public function grant.

## Important Notes
1. Existing submitted data is unchanged.
2. Internal staff can still manage records through authenticated table access.
3. A submitted intake remains readable through its bearer link until it is
   converted or expires, so links should still be shared only with the intended client.
*/

CREATE OR REPLACE FUNCTION save_public_client_intake(p_access_token text, p_payload jsonb, p_submit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved_row client_intakes;
BEGIN
  UPDATE client_intakes
  SET payload = p_payload,
      status = CASE WHEN p_submit THEN 'submitted' ELSE 'draft' END,
      submitted_at = CASE WHEN p_submit THEN COALESCE(submitted_at, now()) ELSE submitted_at END
  WHERE access_token = p_access_token
    AND status = 'draft'
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING * INTO saved_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found or no longer available';
  END IF;

  RETURN jsonb_build_object(
    'id', saved_row.id,
    'status', saved_row.status,
    'updated_at', saved_row.updated_at
  );
END;
$$;
