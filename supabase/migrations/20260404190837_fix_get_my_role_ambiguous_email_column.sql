
/*
  # Fix get_my_role() - Ambiguous Email Column Reference

  The previous version of get_my_role() had a naming conflict: the PL/pgSQL
  function's return table definition declared a column named "email", which
  conflicted with the subquery `SELECT email FROM auth.users`. This caused a
  "column reference email is ambiguous" error, making the function fail silently
  and leaving users defaulting to the Viewer role.

  This version uses an explicit variable to capture the auth email first,
  eliminating the ambiguity.
*/

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  role text,
  is_internal boolean,
  organization_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_email text;
BEGIN
  v_uid := auth.uid();
  SELECT au.email INTO v_email FROM auth.users au WHERE au.id = v_uid;

  RETURN QUERY
  SELECT 
    ur.id,
    ur.user_id,
    ur.email,
    ur.display_name,
    ur.role,
    ur.is_internal,
    ur.organization_id,
    ur.created_at,
    ur.updated_at
  FROM user_roles ur
  WHERE ur.user_id = v_uid
     OR ur.email = v_email
  ORDER BY (ur.user_id = v_uid) DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
