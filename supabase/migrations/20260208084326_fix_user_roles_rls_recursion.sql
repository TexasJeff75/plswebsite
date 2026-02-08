/*
  # Fix user_roles RLS infinite recursion
  
  1. Changes
    - Drop the existing recursive SELECT policy
    - Create a security definer function to check if user is internal (bypasses RLS)
    - Create a new non-recursive SELECT policy using the function
  
  2. Security
    - Function is SECURITY DEFINER so it bypasses RLS to prevent recursion
    - Function is STABLE and marked as LEAKPROOF for query optimization
    - Policy allows users to read their own record OR if they are internal staff
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can read accessible roles" ON user_roles;

-- Create a security definer function to check if current user is internal
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND is_internal = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated;

-- Create new non-recursive SELECT policy
CREATE POLICY "Users can read accessible roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_internal_user() = true
  );
