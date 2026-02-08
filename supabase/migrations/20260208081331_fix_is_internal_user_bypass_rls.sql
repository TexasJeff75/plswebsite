/*
  # Fix is_internal_user function to properly bypass RLS
  
  ## Problem
  The is_internal_user function is SECURITY DEFINER but still subject to RLS
  on the user_roles table. This creates a circular dependency:
  - Policy needs is_internal_user() to evaluate
  - is_internal_user() needs to query user_roles  - user_roles query needs RLS policies to pass
  - Back to step 1 (circular dependency!)
  
  ## Solution
  Grant the function owner (postgres) RLS bypass privilege, or better yet,
  create a helper table or use pg_authid. Instead, we'll use a simpler approach:
  - Check the user_roles table without RLS by using a subquery in the policy directly
  - Use LATERAL join or EXISTS in a way that doesn't trigger RLS
  
  Actually, the best solution is to make the function query user_roles 
  with explicit RLS bypass using security definer + proper grants.
  
  ## Alternative Solution
  Use a simpler policy that checks both conditions inline without a function call
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Internal users can read all roles" ON user_roles;

-- Create a simpler inline policy that doesn't use a function
-- This works because "Users can read own role" policy allows reading your own role
-- So we can check if the current user's role in their own record is internal
CREATE POLICY "Internal users can read all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_roles self
      WHERE self.user_id = auth.uid()
      AND self.is_internal = true
    )
  );
