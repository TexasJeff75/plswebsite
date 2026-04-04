
/*
  # Fix user_roles SELECT policy - permission denied for table users

  The existing SELECT policy on user_roles references auth.users directly
  in its USING clause. When this policy is evaluated during an RLS chain
  (e.g. facilities -> is_internal_user() -> user_roles SELECT policy),
  the inline `SELECT email FROM auth.users` subquery runs as the calling
  user (not SECURITY DEFINER), and the authenticated role does not have
  SELECT on auth.users, causing "permission denied for table users".

  Fix: Create a SECURITY DEFINER helper function get_my_auth_email() that
  safely reads auth.users, then rewrite the user_roles SELECT policy to
  call it instead of querying auth.users inline.
*/

-- Helper: safely fetch calling user's email from auth.users (SECURITY DEFINER bypasses restrictions)
CREATE OR REPLACE FUNCTION public.get_my_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_auth_email() TO authenticated;

-- Drop and recreate the problematic SELECT policy on user_roles
DROP POLICY IF EXISTS "Users can read accessible roles" ON user_roles;

CREATE POLICY "Users can read accessible roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR user_id = (SELECT auth.uid())
    OR email = (SELECT public.get_my_auth_email())
  );
