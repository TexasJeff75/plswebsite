/*
  # Organization-Based Access Control System
  
  This migration implements comprehensive multi-tenant access control allowing
  customer users to only see their assigned organizations and related data.
  
  ## 1. Schema Changes
  
  ### New Table: user_organization_assignments
  - Links users to organizations with specific roles
  - Supports multi-organization assignments for users
  - Tracks assignment history with assigned_by and assigned_at fields
  
  ### Updated Table: user_roles
  - Added is_internal column to distinguish Proximity staff from customer users
  
  ## 2. Helper Functions
  
  - get_user_organization_ids(): Returns array of org IDs user can access
  - user_can_access_organization(): Checks if user can access specific org
  - user_can_access_facility(): Checks if user can access specific facility
  - is_internal_user(): Checks if user is Proximity staff
  - is_admin_user(): Checks if user has admin role
  
  ## 3. Security
  
  - RLS policies use helper functions for consistent access control
  - Internal users (Proximity staff) can see all organizations
  - Customer users only see their assigned organizations
*/

-- Add is_internal column to user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'is_internal'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN is_internal BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing roles to set is_internal flag
UPDATE user_roles 
SET is_internal = true 
WHERE role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist');

UPDATE user_roles 
SET is_internal = false 
WHERE role IN ('Customer Admin', 'Customer Viewer');

-- Create user_organization_assignments table
CREATE TABLE IF NOT EXISTS user_organization_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer',
  is_primary BOOLEAN DEFAULT false,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, organization_id),
  CONSTRAINT valid_org_role CHECK (role IN ('customer_admin', 'customer_user', 'viewer'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_org_assignments_user ON user_organization_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_assignments_org ON user_organization_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_org_assignments_primary ON user_organization_assignments(user_id, is_primary) WHERE is_primary = true;

-- Enable RLS on user_organization_assignments
ALTER TABLE user_organization_assignments ENABLE ROW LEVEL SECURITY;

-- Create helper functions for access control

-- Function to check if user is internal (Proximity staff)
CREATE OR REPLACE FUNCTION is_internal_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND is_internal = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role = 'Proximity Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin or account manager
CREATE OR REPLACE FUNCTION is_admin_or_manager(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role IN ('Proximity Admin', 'Account Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's accessible organization IDs
CREATE OR REPLACE FUNCTION get_user_organization_ids(user_uuid UUID)
RETURNS UUID[] AS $$
DECLARE
  user_is_internal BOOLEAN;
  org_ids UUID[];
BEGIN
  SELECT is_internal INTO user_is_internal
  FROM user_roles
  WHERE user_id = user_uuid;
  
  IF user_is_internal = true THEN
    SELECT ARRAY_AGG(id) INTO org_ids FROM organizations;
    RETURN COALESCE(org_ids, ARRAY[]::UUID[]);
  END IF;
  
  SELECT ARRAY_AGG(organization_id) INTO org_ids
  FROM user_organization_assignments
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(org_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can access specific organization
CREATE OR REPLACE FUNCTION user_can_access_organization(user_uuid UUID, org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF is_internal_user(user_uuid) THEN
    RETURN true;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM user_organization_assignments
    WHERE user_id = user_uuid
    AND organization_id = org_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user can access specific facility
CREATE OR REPLACE FUNCTION user_can_access_facility(user_uuid UUID, facility_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  facility_org_id UUID;
BEGIN
  SELECT organization_id INTO facility_org_id
  FROM facilities
  WHERE id = facility_uuid;
  
  IF facility_org_id IS NULL THEN
    RETURN is_internal_user(user_uuid);
  END IF;
  
  RETURN user_can_access_organization(user_uuid, facility_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get user's role within a specific organization
CREATE OR REPLACE FUNCTION get_user_org_role(user_uuid UUID, org_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  org_role TEXT;
BEGIN
  IF is_internal_user(user_uuid) THEN
    RETURN 'internal';
  END IF;
  
  SELECT role INTO org_role
  FROM user_organization_assignments
  WHERE user_id = user_uuid
  AND organization_id = org_uuid;
  
  RETURN org_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policies for user_organization_assignments

DROP POLICY IF EXISTS "Users can view organization assignments" ON user_organization_assignments;
CREATE POLICY "Users can view organization assignments" ON user_organization_assignments
  FOR SELECT USING (
    is_internal_user(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
      AND uoa.organization_id = user_organization_assignments.organization_id
      AND uoa.role = 'customer_admin'
    )
  );

DROP POLICY IF EXISTS "Admins and managers can create assignments" ON user_organization_assignments;
CREATE POLICY "Admins and managers can create assignments" ON user_organization_assignments
  FOR INSERT WITH CHECK (
    is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Admins and managers can update assignments" ON user_organization_assignments;
CREATE POLICY "Admins and managers can update assignments" ON user_organization_assignments
  FOR UPDATE USING (
    is_admin_or_manager(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete assignments" ON user_organization_assignments;
CREATE POLICY "Admins can delete assignments" ON user_organization_assignments
  FOR DELETE USING (
    is_admin_user(auth.uid())
  );

-- Migrate existing customer users to user_organization_assignments
-- For users with organization_id set in user_roles, create an assignment
INSERT INTO user_organization_assignments (user_id, organization_id, role, is_primary, assigned_at)
SELECT 
  ur.user_id,
  ur.organization_id,
  CASE 
    WHEN ur.role = 'Customer Admin' THEN 'customer_admin'
    ELSE 'viewer'
  END,
  true,
  NOW()
FROM user_roles ur
WHERE ur.organization_id IS NOT NULL
AND ur.is_internal = false
ON CONFLICT (user_id, organization_id) DO NOTHING;
