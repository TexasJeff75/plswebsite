
/*
  # Fix User Profile Fetch - Add RPC for Safe Role Lookup

  ## Summary
  Adds a SECURITY DEFINER function that allows any authenticated user to
  look up their own role safely, bypassing RLS entirely. This prevents
  the case where RLS policy evaluation failures cause users to fall back
  to the default 'Viewer' role.

  Also restores the user_invitations SELECT policy for invited users
  to view their own invitations (by email match).
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
BEGIN
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
  WHERE ur.user_id = auth.uid()
     OR ur.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE POLICY "Users can view invitations sent to their email"
  ON user_invitations FOR SELECT TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  );
