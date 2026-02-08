/*
  # Fix user_roles RLS with single combined policy
  
  ## Problem
  Having two separate SELECT policies creates a circular dependency:
  - "Internal users can read all roles" checks if user is internal
  - That check queries user_roles which triggers RLS evaluation
  - RLS evaluation needs to know if user is internal
  - Circular dependency!
  
  ## Solution
  Combine both policies into a single OR condition:
  - User can read own role (user_id = auth.uid())
  - OR user can read all if they are internal
  
  This way, the self-read check happens first and doesn't create circular dependency
*/

-- Drop both existing SELECT policies
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
DROP POLICY IF EXISTS "Internal users can read all roles" ON user_roles;

-- Create single combined policy
CREATE POLICY "Users can read accessible roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always read their own role
    user_id = auth.uid()
    OR
    -- Internal users can read all roles
    -- This subquery will use the self-read part of this same policy to evaluate
    (
      SELECT is_internal
      FROM user_roles
      WHERE user_id = auth.uid()
    ) = true
  );
