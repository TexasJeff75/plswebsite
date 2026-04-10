/*
  # Fix user_invitations RLS policy that queries auth.users directly

  ## Problem
  The "Users can view invitations sent to their email" policy contained an inline
  subquery on auth.users which is not accessible to regular authenticated users
  in PostgREST's security context. This caused "permission denied for table users"
  for ALL users on ANY query to user_invitations because Postgres evaluates ALL
  applicable policies together.

  ## Fix
  Replace the inline auth.users subquery with get_my_auth_email(), which is a
  SECURITY DEFINER function that safely accesses auth.users.
*/

DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON user_invitations;

CREATE POLICY "Users can view invitations sent to their email"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT get_my_auth_email())
  );
