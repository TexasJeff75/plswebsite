/*
  # Fix Deployments RLS & Function Search Paths

  This migration fixes critical security issues:
  1. Deployments table had RLS policies that allowed unrestricted access (USING true)
  2. Functions had mutable search_path which could lead to security vulnerabilities

  ## Security Fixes:
  - Replace permissive deployments RLS with proper access controls
  - Set immutable search_path on all security-sensitive functions
*/

-- =============================================
-- FIX DEPLOYMENTS TABLE RLS
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can delete deployments" ON deployments;
DROP POLICY IF EXISTS "Authenticated users can insert deployments" ON deployments;
DROP POLICY IF EXISTS "Authenticated users can update deployments" ON deployments;
DROP POLICY IF EXISTS "Authenticated users can view deployments" ON deployments;

CREATE POLICY "Internal users can view deployments"
  ON deployments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can create deployments"
  ON deployments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update deployments"
  ON deployments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Admins can delete deployments"
  ON deployments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- FIX FUNCTION SEARCH PATHS
-- Drop and recreate functions with secure search_path
-- =============================================

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.is_proximity_staff(uuid);

-- Recreate handle_new_user with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, display_name, role, is_internal)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Client User'),
    COALESCE((new.raw_user_meta_data->>'is_internal')::boolean, false)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, user_roles.display_name);
  RETURN new;
END;
$$;

-- Recreate get_user_role with secure search_path
CREATE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_roles
  WHERE user_id = user_uuid;
  RETURN COALESCE(user_role, 'Client User');
END;
$$;

-- Recreate is_proximity_staff with secure search_path
CREATE FUNCTION public.is_proximity_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND is_internal = true
  );
END;
$$;

-- Recreate is_internal_user with secure search_path
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_internal = true
  );
END;
$$;

-- Recreate user_can_access_organization with secure search_path
CREATE OR REPLACE FUNCTION public.user_can_access_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_internal = true
  )
  OR EXISTS (
    SELECT 1 FROM user_organization_assignments
    WHERE user_id = auth.uid()
    AND organization_id = org_id
  );
END;
$$;

-- Recreate user_can_access_facility with secure search_path
CREATE OR REPLACE FUNCTION public.user_can_access_facility(facility_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_internal = true
  )
  OR EXISTS (
    SELECT 1 FROM facilities f
    JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
    WHERE f.id = facility_id
    AND uoa.user_id = auth.uid()
  );
END;
$$;

-- Recreate get_user_org_role with secure search_path
CREATE OR REPLACE FUNCTION public.get_user_org_role(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_role text;
BEGIN
  SELECT role INTO org_role
  FROM user_organization_assignments
  WHERE user_id = auth.uid()
  AND organization_id = org_id;
  RETURN org_role;
END;
$$;

-- Recreate is_admin_user with secure search_path
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'Proximity Admin'
  );
END;
$$;

-- Recreate is_admin_or_manager with secure search_path
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('Proximity Admin', 'Account Manager')
  );
END;
$$;

-- Recreate get_user_organization_ids with secure search_path
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_ids uuid[];
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_internal = true) THEN
    SELECT array_agg(id) INTO org_ids FROM organizations;
  ELSE
    SELECT array_agg(organization_id) INTO org_ids
    FROM user_organization_assignments
    WHERE user_id = auth.uid();
  END IF;
  RETURN COALESCE(org_ids, ARRAY[]::uuid[]);
END;
$$;

-- Recreate update_updated_at_column with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate generate_ticket_number with secure search_path
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
  ticket_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM support_tickets
  WHERE ticket_number LIKE 'TKT-%';
  
  ticket_num := 'TKT-' || LPAD(next_num::text, 6, '0');
  RETURN ticket_num;
END;
$$;

-- Recreate set_ticket_number with secure search_path
CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;
