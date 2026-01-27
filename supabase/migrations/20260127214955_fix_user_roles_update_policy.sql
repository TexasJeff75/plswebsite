/*
  # Fix User Roles Update Policy

  1. Changes
    - Drop the existing restrictive update policy for user_roles
    - Add new update policy allowing Proximity staff to update any user role
    - Keep existing policy allowing users to update their own record

  2. Security
    - Proximity Admin and Proximity Staff can update any user role
    - Regular users can still update their own record by email match
    - Both policies are permissive, so either condition allows the update
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can update own record by email" ON user_roles;

-- Allow users to update their own record
CREATE POLICY "Users can update own record by email"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text)
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid())::text);

-- Allow Proximity staff to update any user role
CREATE POLICY "Proximity staff can update user roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (is_proximity_staff(auth.uid()))
  WITH CHECK (is_proximity_staff(auth.uid()));
