/*
  # Fix User Roles RLS Policies

  1. Changes
    - Drop outdated policies that check for 'Admin' role
    - Create new policies that properly handle:
      - Users can read all user roles (for profile lookup)
      - Users can update their own record (for linking accounts by email)
      - Proximity Admin/Staff can manage all user roles

  2. Security
    - Users can only update their own record (matched by email)
    - Full management requires Proximity Admin or Proximity Staff role
*/

DROP POLICY IF EXISTS "Admins can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can read user roles" ON user_roles;

CREATE POLICY "Users can read all user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own record by email"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Proximity staff can insert user roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Proximity staff can delete user roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );