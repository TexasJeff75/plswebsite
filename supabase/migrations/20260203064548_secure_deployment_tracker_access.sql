/*
  # Secure Deployment Tracker Access

  ## Overview
  Removes public access from deployment tracker and implements proper authentication
  and organization-based access control.

  ## Changes
    1. Remove all public (anon) read policies
    2. Add authenticated-only policies with organization-based access control
    3. Internal users (Proximity staff) can see all deployment tracker data
    4. Customer users can only see deployment tracker data for their assigned organizations

  ## Security
    - No unauthenticated access allowed
    - Customer users restricted to their assigned organizations
    - Internal users have full access
*/

-- Drop all existing public policies
DROP POLICY IF EXISTS "Allow public read access to deployment_organizations" ON deployment_organizations;
DROP POLICY IF EXISTS "Allow public read access to deployment_projects" ON deployment_projects;
DROP POLICY IF EXISTS "Allow public read access to deployment_facilities" ON deployment_facilities;

-- deployment_organizations policies
CREATE POLICY "Authenticated users can view deployment orgs they have access to"
  ON deployment_organizations
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user(auth.uid())
    OR id IN (SELECT unnest(get_user_organization_ids(auth.uid())))
  );

CREATE POLICY "Admins and managers can insert deployment orgs"
  ON deployment_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update deployment orgs"
  ON deployment_organizations
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete deployment orgs"
  ON deployment_organizations
  FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- deployment_projects policies
CREATE POLICY "Authenticated users can view deployment projects they have access to"
  ON deployment_projects
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user(auth.uid())
    OR organization_id IN (SELECT unnest(get_user_organization_ids(auth.uid())))
  );

CREATE POLICY "Admins and managers can insert deployment projects"
  ON deployment_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update deployment projects"
  ON deployment_projects
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete deployment projects"
  ON deployment_projects
  FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- deployment_facilities policies
CREATE POLICY "Authenticated users can view deployment facilities they have access to"
  ON deployment_facilities
  FOR SELECT
  TO authenticated
  USING (
    is_internal_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM deployment_projects dp
      WHERE dp.id = deployment_facilities.project_id
      AND dp.organization_id IN (SELECT unnest(get_user_organization_ids(auth.uid())))
    )
  );

CREATE POLICY "Admins and managers can insert deployment facilities"
  ON deployment_facilities
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update deployment facilities"
  ON deployment_facilities
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete deployment facilities"
  ON deployment_facilities
  FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Add index for better performance on organization-based queries
CREATE INDEX IF NOT EXISTS idx_deployment_projects_org_id_lookup 
  ON deployment_projects(organization_id) 
  WHERE organization_id IS NOT NULL;
