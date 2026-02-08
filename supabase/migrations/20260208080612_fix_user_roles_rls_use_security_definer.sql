/*
  # Fix User Roles RLS - Use Security Definer Function
  
  ## Problem
  The "Internal users can read all roles" policy has a circular dependency:
  - Policy checks: EXISTS (SELECT FROM user_roles WHERE is_internal)
  - But to execute that subquery, it needs to pass RLS on user_roles
  - Which creates a chicken-and-egg problem
  
  ## Solution
  Use the existing is_internal_user() SECURITY DEFINER function which:
  - Runs with elevated privileges
  - Bypasses RLS when checking user_roles
  - Breaks the circular dependency
  
  ## Changes
  - Drop and recreate "Internal users can read all roles" policy
  - New policy uses is_internal_user(auth.uid()) function
  - This function is SECURITY DEFINER so it bypasses RLS
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Internal users can read all roles" ON user_roles;

-- Recreate it using the security definer function
-- The is_internal_user(uuid) function bypasses RLS, breaking the circular dependency
CREATE POLICY "Internal users can read all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (is_internal_user(auth.uid()));
