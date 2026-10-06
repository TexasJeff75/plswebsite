/*
# Link Converted Intakes to Facilities

## Summary
Keeps the completed onboarding record connected to the facility created from it.
This preserves the original service selections, testing estimates, corporate data,
and submitted contacts for future reference.

## Modified Table
- `client_intakes.facility_id`: optional foreign key to the created facility.
  It is populated only after a successful conversion.

## Security
- The existing RLS and function permissions remain unchanged.
- Only the authorized conversion function writes the facility link.
*/

ALTER TABLE client_intakes
  ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES facilities(id);

CREATE INDEX IF NOT EXISTS idx_client_intakes_facility_id ON client_intakes(facility_id);

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
  SET status = 'converted', facility_id = facility_id, converted_by = auth.uid(), converted_at = now()
  WHERE id = intake_row.id;

  RETURN facility_id;
END;
$$;
