/*
# Add Client Intake Submission Challenge

## Summary
Adds a lightweight human-verification challenge to the final public intake
submission. The client receives a short arithmetic question tied to the private
intake link and must answer it before the submission is accepted.

## New Table: client_intake_challenges
- `id`: one-time challenge identifier.
- `client_intake_id`: intake the challenge belongs to.
- `question`: question displayed to the client.
- `answer`: server-side expected answer.
- `expires_at`: short challenge lifetime.
- `used_at`: timestamp set when the correct answer is accepted.
- `created_at`: challenge creation timestamp.

## Modified Function
- `save_public_client_intake`: final submissions now require a valid, unused,
  unexpired challenge ID and answer. Draft autosaves continue without a challenge.

## Security Changes
- The challenge table has RLS enabled and no direct anonymous table privileges.
- Challenge creation and submission verification are exposed only through narrow
  token-scoped functions.
- Challenge verification and consumption occur atomically in the database.
- The prior three-argument save function is removed so it cannot bypass the new
  final-submission check.

## Important Notes
1. This adds meaningful bot friction without requiring a third-party CAPTCHA key.
2. It is not equivalent to Cloudflare Turnstile or hCaptcha against sophisticated
   automated systems; those can be added later if stronger assurance is required.
3. Existing draft and submitted intake data is unchanged.
*/

CREATE TABLE IF NOT EXISTS client_intake_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_intake_id uuid NOT NULL REFERENCES client_intakes(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_intake_challenges_intake ON client_intake_challenges(client_intake_id);
CREATE INDEX IF NOT EXISTS idx_client_intake_challenges_expiry ON client_intake_challenges(expires_at);

ALTER TABLE client_intake_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view intake challenges" ON client_intake_challenges;
CREATE POLICY "Internal users can view intake challenges"
ON client_intake_challenges FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

DROP POLICY IF EXISTS "Internal users can create intake challenges" ON client_intake_challenges;
CREATE POLICY "Internal users can create intake challenges"
ON client_intake_challenges FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

DROP POLICY IF EXISTS "Internal users can update intake challenges" ON client_intake_challenges;
CREATE POLICY "Internal users can update intake challenges"
ON client_intake_challenges FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

DROP POLICY IF EXISTS "Internal users can delete intake challenges" ON client_intake_challenges;
CREATE POLICY "Internal users can delete intake challenges"
ON client_intake_challenges FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

REVOKE ALL ON TABLE client_intake_challenges FROM anon;

CREATE OR REPLACE FUNCTION create_public_client_intake_challenge(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake_id uuid;
  first_number integer;
  second_number integer;
  challenge_id uuid;
BEGIN
  SELECT id INTO intake_id
  FROM client_intakes
  WHERE access_token = p_access_token
    AND status = 'draft'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found or no longer available';
  END IF;

  first_number := 1 + floor(random() * 9)::integer;
  second_number := 1 + floor(random() * 9)::integer;

  INSERT INTO client_intake_challenges (client_intake_id, question, answer)
  VALUES (intake_id, format('What is %s + %s?', first_number, second_number), (first_number + second_number)::text)
  RETURNING id INTO challenge_id;

  RETURN jsonb_build_object(
    'challenge_id', challenge_id,
    'question', format('What is %s + %s?', first_number, second_number)
  );
END;
$$;

DROP FUNCTION IF EXISTS save_public_client_intake(text, jsonb, boolean);

CREATE OR REPLACE FUNCTION save_public_client_intake(
  p_access_token text,
  p_payload jsonb,
  p_submit boolean DEFAULT false,
  p_challenge_id uuid DEFAULT NULL,
  p_challenge_answer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved_row client_intakes;
  challenge_row client_intake_challenges;
BEGIN
  IF p_submit THEN
    UPDATE client_intake_challenges c
    SET used_at = now()
    FROM client_intakes i
    WHERE c.id = p_challenge_id
      AND c.client_intake_id = i.id
      AND i.access_token = p_access_token
      AND c.answer = trim(p_challenge_answer)
      AND c.used_at IS NULL
      AND c.expires_at > now()
    RETURNING c.* INTO challenge_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Human verification failed or expired';
    END IF;
  END IF;

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

REVOKE ALL ON FUNCTION create_public_client_intake_challenge(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_public_client_intake_challenge(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION save_public_client_intake(text, jsonb, boolean, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_public_client_intake(text, jsonb, boolean, uuid, text) TO anon, authenticated;
