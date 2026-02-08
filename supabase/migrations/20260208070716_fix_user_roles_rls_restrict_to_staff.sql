/*
  # Fix User Roles RLS - Restrict to Proximity Staff Only

  1. Changes
    - Drop the overly permissive "Users can read all user roles" policy
    - Create new restrictive policy that only allows internal users to read user roles
    - Update INSERT policy to ensure only internal users can create user roles
    - Update UPDATE policy to only allow internal users to modify user roles
    - Keep DELETE policy restricted to Proximity Admin

  2. Security
    - Only Proximity staff (internal users) can view all user roles
    - Only Proximity staff can create and modify user roles
    - Only Proximity Admin can delete user roles
    - Customer Admins can no longer see or modify other users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read all user roles" ON user_roles;
DROP POLICY IF EXISTS "Internal users can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Internal users can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;

-- Only internal users (Proximity staff) can read user roles
CREATE POLICY "Internal users can read all user roles"
  ON user_roles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  );

-- Only internal users can insert user roles
CREATE POLICY "Internal users can insert user roles"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  );

-- Only internal users can update user roles
CREATE POLICY "Internal users can update user roles"
  ON user_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  );

-- Only Proximity Admin can delete user roles
CREATE POLICY "Proximity Admin can delete user roles"
  ON user_roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.role = 'Proximity Admin'
    )
  );
