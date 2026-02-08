/*
  # Fix User Roles RLS - Allow Self-Read
  
  ## Problem
  The current RLS policies on user_roles create a chicken-and-egg problem:
  - To read ANY user_roles records, you must be an internal user
  - To know if you're an internal user, you must read your user_roles record
  - This creates a circular dependency preventing users from reading their own role
  
  ## Solution
  Add a policy that allows users to read their OWN role record without requiring
  internal status check. This breaks the circular dependency.
  
  ## Changes
  1. Add policy: Users can always read their own role
  2. Keep existing policy: Internal users can read all roles
  
  ## Security Impact
  - Users can only read their own role record (user_id = auth.uid())
  - Internal users can still read all roles
  - No security degradation, fixes authentication flow
*/

-- Drop existing restrictive SELECT policy if it exists
DROP POLICY IF EXISTS "Internal users can read all user roles" ON user_roles;

-- Policy 1: Users can ALWAYS read their own role (no circular dependency)
CREATE POLICY "Users can read own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Internal users can read ALL roles
CREATE POLICY "Internal users can read all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() 
      AND ur.is_internal = true
    )
  );
