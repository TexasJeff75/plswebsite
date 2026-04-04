
/*
  # Fix has_facility_access_via_contacts function

  The existing function joins user_organization_assignments on uoa.user_role_id
  and checks uoa.can_view_facilities — neither of these columns exist on the table.

  The actual columns are:
    - user_organization_assignments.user_id (not user_role_id via user_roles join)
    - user_organization_assignments.organization_id
    - user_organization_assignments.role

  This fix rewrites the function to use the correct schema.
*/

CREATE OR REPLACE FUNCTION public.has_facility_access_via_contacts(check_facility_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value text;
  org_id uuid;
BEGIN
  SELECT role INTO user_role_value
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF user_role_value IN ('Proximity Admin', 'Proximity Staff', 'Super Admin') THEN
    RETURN true;
  END IF;

  IF (SELECT is_internal_user()) THEN
    RETURN true;
  END IF;

  SELECT organization_id INTO org_id
  FROM facilities
  WHERE id = check_facility_id;

  RETURN EXISTS (
    SELECT 1
    FROM user_organization_assignments uoa
    WHERE uoa.user_id = auth.uid()
    AND uoa.organization_id = org_id
  );
END;
$$;
