/*
  # Fix user_organization_assignments RLS to prevent recursion
  
  1. Changes
    - Drop existing policies that query user_roles (causes recursion)
    - Create new policies using the is_internal_user() security definer function
  
  2. Security
    - Uses security definer function to avoid RLS recursion
    - Maintains same permission logic but without infinite loops
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view organization assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Admins and managers can create assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Admins and managers can update assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON user_organization_assignments;

-- Recreate SELECT policy without recursion
CREATE POLICY "Users can view organization assignments"
  ON user_organization_assignments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_internal_user() = true
  );

-- Recreate INSERT policy without recursion
CREATE POLICY "Admins and managers can create assignments"
  ON user_organization_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
  );

-- Recreate UPDATE policy without recursion
CREATE POLICY "Admins and managers can update assignments"
  ON user_organization_assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_internal_user() = true
  )
  WITH CHECK (
    public.is_internal_user() = true
  );

-- Recreate DELETE policy without recursion
CREATE POLICY "Admins can delete assignments"
  ON user_organization_assignments
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user() = true
  );
