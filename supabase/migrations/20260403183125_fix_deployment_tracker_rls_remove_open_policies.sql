/*
  # Fix Deployment Tracker RLS Policies

  ## Problem
  Two sets of security issues were found:

  ### 1. deployment_* tables (deployment_organizations, deployment_projects, deployment_facilities)
  These tables have DUPLICATE policies — one set with proper role checks (is_admin_user,
  is_admin_or_manager, is_internal_user) AND a second set named "Allow authenticated users to ..."
  with USING (true) / WITH CHECK (true). The open `true` policies completely nullify the role-based
  restrictions, allowing any authenticated user to read, write, update, and delete regardless of role.

  ### 2. tracker_* tables (tracker_organizations, tracker_projects, tracker_facilities)
  These are the legacy public-facing tracker tables. They have:
  - Public anon SELECT access (intentional for the public tracker page)
  - Any authenticated user can INSERT/UPDATE with no restrictions (dangerous — should require admin/manager)
  - No DELETE policy for non-super-admin users (only Super Admin can delete)

  ## Changes

  ### deployment_* tables
  - DROP the three broad "Allow authenticated users to ..." policies for INSERT, UPDATE, DELETE
  - Keep the specific role-based policies (is_admin_or_manager, is_admin_user, is_internal_user)
  - Super Admin policies remain untouched

  ### tracker_* tables
  - Keep the anon SELECT policy (public tracker page needs it)
  - Replace the open authenticated INSERT/UPDATE policies with role-restricted versions
  - Add proper DELETE policies for Proximity Admin and Account Manager roles

  ## Security Model After Fix

  ### deployment_* tables
  - SELECT: Internal users (Proximity staff) OR users assigned to that organization
  - INSERT/UPDATE: Proximity Admin or Account Manager only
  - DELETE: Proximity Admin only
  - Super Admin: Full access (all operations)

  ### tracker_* tables
  - SELECT: Public (anon) read — tracker page is public-facing
  - INSERT/UPDATE: Proximity Admin or Account Manager only
  - DELETE: Proximity Admin only
  - Super Admin: Full access (all operations)
*/

-- =============================================================================
-- deployment_organizations: remove open policies
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert deployment_organizations" ON deployment_organizations;
DROP POLICY IF EXISTS "Allow authenticated users to update deployment_organizations" ON deployment_organizations;
DROP POLICY IF EXISTS "Allow authenticated users to delete deployment_organizations" ON deployment_organizations;

-- =============================================================================
-- deployment_projects: remove open policies
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert deployment_projects" ON deployment_projects;
DROP POLICY IF EXISTS "Allow authenticated users to update deployment_projects" ON deployment_projects;
DROP POLICY IF EXISTS "Allow authenticated users to delete deployment_projects" ON deployment_projects;

-- =============================================================================
-- deployment_facilities: remove open policies
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert deployment_facilities" ON deployment_facilities;
DROP POLICY IF EXISTS "Allow authenticated users to update deployment_facilities" ON deployment_facilities;
DROP POLICY IF EXISTS "Allow authenticated users to delete deployment_facilities" ON deployment_facilities;

-- =============================================================================
-- tracker_organizations: replace open write policies with role-restricted ones
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert tracker_organizations" ON tracker_organizations;
DROP POLICY IF EXISTS "Allow authenticated users to update tracker_organizations" ON tracker_organizations;

CREATE POLICY "Admins and managers can insert tracker organizations"
  ON tracker_organizations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update tracker organizations"
  ON tracker_organizations FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete tracker organizations"
  ON tracker_organizations FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- =============================================================================
-- tracker_projects: replace open write policies with role-restricted ones
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert tracker_projects" ON tracker_projects;
DROP POLICY IF EXISTS "Allow authenticated users to update tracker_projects" ON tracker_projects;

CREATE POLICY "Admins and managers can insert tracker projects"
  ON tracker_projects FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update tracker projects"
  ON tracker_projects FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete tracker projects"
  ON tracker_projects FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- =============================================================================
-- tracker_facilities: replace open write policies with role-restricted ones
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated users to insert tracker_facilities" ON tracker_facilities;
DROP POLICY IF EXISTS "Allow authenticated users to update tracker_facilities" ON tracker_facilities;

CREATE POLICY "Admins and managers can insert tracker facilities"
  ON tracker_facilities FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can update tracker facilities"
  ON tracker_facilities FOR UPDATE
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete tracker facilities"
  ON tracker_facilities FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- =============================================================================
-- Also add authenticated SELECT to tracker_* tables so internal users can
-- read via the app (anon covers the public tracker page)
-- =============================================================================
CREATE POLICY "Authenticated users can view tracker organizations"
  ON tracker_organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view tracker projects"
  ON tracker_projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view tracker facilities"
  ON tracker_facilities FOR SELECT
  TO authenticated
  USING (true);
