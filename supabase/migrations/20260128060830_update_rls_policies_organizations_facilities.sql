/*
  # Update RLS Policies for Organizations and Facilities
  
  This migration updates the Row Level Security policies for the organizations
  and facilities tables to use the new organization-based access control system.
  
  ## Organizations Table
  - SELECT: Users can only view organizations they have access to
  - INSERT: Only internal users can create organizations
  - UPDATE: Internal users can update any org; customer_admin can update their assigned orgs
  - DELETE: Only admins can delete organizations
  
  ## Facilities Table
  - SELECT: Users can only view facilities in their accessible organizations
  - INSERT: Internal users can create in any org; customer_admin in their orgs
  - UPDATE: Internal users or customer roles with appropriate permissions
  - DELETE: Only internal users can delete facilities
  
  ## Security
  - All policies use helper functions for consistent access control
  - Customer users restricted to their assigned organizations only
*/

-- Drop existing policies on organizations
DROP POLICY IF EXISTS "Public read access for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can read organizations" ON organizations;
DROP POLICY IF EXISTS "Staff can manage organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view assigned organizations" ON organizations;
DROP POLICY IF EXISTS "Internal users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update accessible organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;

-- Organizations RLS Policies

CREATE POLICY "Users can view assigned organizations" ON organizations
  FOR SELECT USING (
    user_can_access_organization(auth.uid(), id)
  );

CREATE POLICY "Internal users can create organizations" ON organizations
  FOR INSERT WITH CHECK (
    is_internal_user(auth.uid())
  );

CREATE POLICY "Users can update accessible organizations" ON organizations
  FOR UPDATE USING (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), id)
      AND EXISTS (
        SELECT 1 FROM user_organization_assignments
        WHERE user_id = auth.uid()
        AND organization_id = organizations.id
        AND role = 'customer_admin'
      )
    )
  ) WITH CHECK (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), id)
      AND EXISTS (
        SELECT 1 FROM user_organization_assignments
        WHERE user_id = auth.uid()
        AND organization_id = organizations.id
        AND role = 'customer_admin'
      )
    )
  );

CREATE POLICY "Admins can delete organizations" ON organizations
  FOR DELETE USING (
    is_admin_user(auth.uid())
  );

-- Drop existing policies on facilities
DROP POLICY IF EXISTS "Public read access for authenticated users" ON facilities;
DROP POLICY IF EXISTS "Users can view facilities" ON facilities;
DROP POLICY IF EXISTS "Authenticated users can read facilities" ON facilities;
DROP POLICY IF EXISTS "Staff can manage facilities" ON facilities;
DROP POLICY IF EXISTS "Users can view facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Users can create facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Users can update facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Internal users can delete facilities" ON facilities;

-- Facilities RLS Policies

CREATE POLICY "Users can view facilities in accessible organizations" ON facilities
  FOR SELECT USING (
    organization_id IS NULL AND is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Users can create facilities in accessible organizations" ON facilities
  FOR INSERT WITH CHECK (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), organization_id)
      AND EXISTS (
        SELECT 1 FROM user_organization_assignments
        WHERE user_id = auth.uid()
        AND organization_id = facilities.organization_id
        AND role = 'customer_admin'
      )
    )
  );

CREATE POLICY "Users can update facilities in accessible organizations" ON facilities
  FOR UPDATE USING (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), organization_id)
      AND EXISTS (
        SELECT 1 FROM user_organization_assignments
        WHERE user_id = auth.uid()
        AND organization_id = facilities.organization_id
        AND role IN ('customer_admin', 'customer_user')
      )
    )
  ) WITH CHECK (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), organization_id)
      AND EXISTS (
        SELECT 1 FROM user_organization_assignments
        WHERE user_id = auth.uid()
        AND organization_id = facilities.organization_id
        AND role IN ('customer_admin', 'customer_user')
      )
    )
  );

CREATE POLICY "Internal users can delete facilities" ON facilities
  FOR DELETE USING (
    is_internal_user(auth.uid())
  );
