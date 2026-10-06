/*
# Fix Client Intake Facility Link Assignment

## Summary
Clarifies the variable used by the intake conversion function so the new
facility ID is written to `client_intakes.facility_id` without ambiguity.

## Security
- No access rules change.
- The same internal-role authorization remains enforced inside the function.
*/

CREATE OR REPLACE FUNCTION convert_client_intake(p_intake_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intake_row client_intakes;
  v_facility_id uuid;
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
  RETURNING id INTO v_facility_id;

  providers := COALESCE(intake_row.payload->'providers', '[]'::jsonb);
  FOR person IN SELECT value FROM jsonb_array_elements(providers) LOOP
    person_name := trim(concat_ws(' ', person->>'first_name', person->>'last_name'));
    IF person_name <> '' THEN
      INSERT INTO facility_contacts (facility_id, name, role, phone, email, notes)
      VALUES (v_facility_id, person_name, COALESCE(NULLIF(person->>'role', ''), 'Provider'), NULLIF(person->>'phone', ''), NULLIF(person->>'email', ''), NULLIF(person->>'credentials', ''));
    END IF;
  END LOOP;

  office_staff := COALESCE(intake_row.payload->'office_staff', '[]'::jsonb);
  FOR person IN SELECT value FROM jsonb_array_elements(office_staff) LOOP
    person_name := trim(concat_ws(' ', person->>'first_name', person->>'last_name'));
    IF person_name <> '' THEN
      INSERT INTO facility_contacts (facility_id, name, role, phone, email)
      VALUES (v_facility_id, person_name, 'Office Staff', NULLIF(person->>'phone', ''), NULLIF(person->>'email', ''));
    END IF;
  END LOOP;

  UPDATE client_intakes
  SET facility_id = v_facility_id, status = 'converted', converted_by = auth.uid(), converted_at = now()
  WHERE id = intake_row.id;

  RETURN v_facility_id;
END;
$$;
