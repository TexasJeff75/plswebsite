/*
  # Fix user_invitations RLS to allow Customer Admins to view invitations

  ## Problem
  Customer Admins can INSERT invitations (per existing policy) but cannot SELECT them.
  This causes a 403 when the invitation service checks for existing invitations before creating,
  and when loading the invitations list.

  ## Changes
  - Drop the existing restrictive SELECT policies
  - Recreate a unified SELECT policy that also allows Customer Admins to view invitations
    they are allowed to manage (i.e., all invitations in the system, since they need to
    check for duplicates and manage their org's users)
*/

DROP POLICY IF EXISTS "Admins can view all invitations" ON user_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON user_invitations;

CREATE POLICY "Admins and customer admins can view invitations"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (
    (SELECT is_internal_user()) = true
    OR invited_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Users can view invitations sent to their email"
  ON user_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  );
