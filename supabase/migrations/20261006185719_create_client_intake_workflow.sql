/*
# Create New Client Intake Workflow

## Summary
Adds a resumable New Client Intake workflow for deployment onboarding. Internal
staff create a share token, the client completes the form over multiple visits,
and staff can convert a submitted intake into one facility and its contacts.

## New Table: client_intakes
- `id`: unique intake identifier.
- `access_token`: high-entropy share token used only in the public link.
- `organization_id`: internal client organization selected by staff.
- `project_id`: optional deployment project selected by staff.
- `payload`: JSON form data, including corporate information, clinic details,
  requested services, testing volumes, providers, and office staff.
- `status`: draft, submitted, converted, or expired.
- `expires_at`: optional expiration date for the share link.
- `created_by`, `converted_by`: authenticated internal users responsible for the intake.
- timestamps for creation, updates, submission, and conversion.

## Security
- Row-level security is enabled and no direct anonymous table access is granted.
- Public users can only use the narrowly scoped token RPCs to retrieve and save
  the intake associated with the token in their link.
- Public token actions cannot read arbitrary intake rows or convert an intake.
- Internal staff use authenticated RPCs to create, list, and convert intakes.
- Conversion checks the caller's role inside the security-definer function and
  creates the facility and contacts atomically within the database function.
*/

CREATE TABLE IF NOT EXISTS client_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  organization_id uuid REFERENCES organizations(id),
  project_id uuid REFERENCES projects(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'converted', 'expired')),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  converted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  converted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_client_intakes_status ON client_intakes(status);
CREATE INDEX IF NOT EXISTS idx_client_intakes_created_by ON client_intakes(created_by);
CREATE INDEX IF NOT EXISTS idx_client_intakes_updated_at ON client_intakes(updated_at DESC);

ALTER TABLE client_intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can view client intakes" ON client_intakes;
CREATE POLICY "Internal users can view client intakes"
ON client_intakes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

DROP POLICY IF EXISTS "Internal users can create client intakes" ON client_intakes;
CREATE POLICY "Internal users can create client intakes"
ON client_intakes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS "Internal users can update client intakes" ON client_intakes;
CREATE POLICY "Internal users can update client intakes"
ON client_intakes FOR UPDATE
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

DROP POLICY IF EXISTS "Internal users can delete client intakes" ON client_intakes;
CREATE POLICY "Internal users can delete client intakes"
ON client_intakes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff', 'Super Admin')
  )
);

CREATE OR REPLACE FUNCTION update_client_intakes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_intakes_updated_at ON client_intakes;
CREATE TRIGGER client_intakes_updated_at
BEFORE UPDATE ON client_intakes
FOR EACH ROW EXECUTE FUNCTION update_client_intakes_updated_at();

CREATE OR REPLACE FUNCTION get_public_client_intake(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake_row client_intakes;
BEGIN
  SELECT * INTO intake_row
  FROM client_intakes
  WHERE access_token = p_access_token
    AND status <> 'converted'
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake not found';
  END IF;

  RETURN jsonb_build_object(
    'id', intake_row.id,
    'payload', intake_row.payload,
    'status', intake_row.status,
    'expires_at', intake_row.expires_at
  );
END;
$$;

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
    AND status IN ('draft', 'submitted')
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

CREATE OR REPLACE FUNCTION convert_client_intake(p_intake_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake_row client_intakes;
  facility_id uuid;
  actor_role text;
  clinic jsonb;
  corporate jsonb;
  providers jsonb;
  office_staff jsonb;
  person jsonb;
  person_name text;
  person_role text;
BEGIN
  SELECT role INTO actor_role
  FROM user_roles
  WHERE user_id = auth.uid();

  IF actor_role NOT IN ('Proximity Admin', 'Proximity Staff', 'Super Admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO intake_row
  FROM client_intakes
  WHERE id = p_intake_id
  FOR UPDATE;

  IF NOT FOUND OR intake_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Intake is not ready for conversion';
  END IF;

  clinic := COALESCE(intake_row.payload->'clinic', '{}'::jsonb);
  corporate := COALESCE(intake_row.payload->'corporate', '{}'::jsonb);

  INSERT INTO facilities (
    organization_id, project_id, name, address, city, state, zip,
    facility_type, site_configuration, status, phase, created_by, updated_by
  ) VALUES (
    intake_row.organization_id,
    intake_row.project_id,
    COALESCE(NULLIF(clinic->>'name', ''), NULLIF(corporate->>'name', ''), 'New Client Facility'),
    NULLIF(clinic->>'street_address', ''),
    NULLIF(clinic->>'city', ''),
    NULLIF(clinic->>'state', ''),
    NULLIF(clinic->>'zip', ''),
    'Clinic',
    'waived',
    'Planning',
    'Phase 1',
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO facility_id;

  providers := COALESCE(intake_row.payload->'providers', '[]'::jsonb);
  FOR person IN SELECT value FROM jsonb_array_elements(providers) LOOP
    person_name := trim(concat_ws(' ', person->>'first_name', person->>'last_name'));
    IF person_name <> '' THEN
      INSERT INTO facility_contacts (facility_id, name, role, phone, email, notes)
      VALUES (facility_id, person_name, COALESCE(NULLIF(person->>'role', ''), 'Provider'), NULLIF(person->>'phone', ''), NULLIF(person->>'email', ''), NULLIF(person->>'credentials', ''));
    END IF;
  END LOOP;

  office_staff := COALESCE(intake_row.payload->'office_staff', '[]'::jsonb);
  FOR person IN SELECT value FROM jsonb_array_elements(office_staff) LOOP
    person_name := trim(concat_ws(' ', person->>'first_name', person->>'last_name'));
    IF person_name <> '' THEN
      INSERT INTO facility_contacts (facility_id, name, role, phone, email)
      VALUES (facility_id, person_name, 'Office Staff', NULLIF(person->>'phone', ''), NULLIF(person->>'email', ''));
    END IF;
  END LOOP;

  UPDATE client_intakes
  SET status = 'converted', converted_by = auth.uid(), converted_at = now()
  WHERE id = intake_row.id;

  RETURN facility_id;
END;
$$;

REVOKE ALL ON FUNCTION get_public_client_intake(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_client_intake(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION save_public_client_intake(text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_public_client_intake(text, jsonb, boolean) TO anon, authenticated;
REVOKE ALL ON FUNCTION convert_client_intake(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION convert_client_intake(uuid) TO authenticated;
