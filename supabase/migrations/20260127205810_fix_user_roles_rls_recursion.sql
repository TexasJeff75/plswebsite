/*
  # Fix User Roles RLS Recursion Issue

  1. Changes
    - Create security definer function to check user role without recursion
    - Update RLS policies to use the function
    - This prevents the 500 error caused by policy recursion

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS during check
    - Properly validates roles for insert/delete operations
*/

CREATE OR REPLACE FUNCTION public.get_user_role(check_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = check_user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_proximity_staff(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = check_user_id 
    AND role IN ('Proximity Admin', 'Proximity Staff')
  );
$$;

DROP POLICY IF EXISTS "Proximity staff can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Proximity staff can delete user roles" ON user_roles;

CREATE POLICY "Proximity staff can insert user roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_proximity_staff(auth.uid()));

CREATE POLICY "Proximity staff can delete user roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (public.is_proximity_staff(auth.uid()));