/*
  # Fix RLS Auth Initialization Plan

  ## Summary
  Replaces bare `auth.uid()` calls with `(SELECT auth.uid())` in RLS policies
  to prevent re-evaluation per row. This improves query performance by evaluating
  auth functions once per query statement instead of once per row.

  ## Tables fixed
  - facilities: "Users can view facilities in accessible organizations"
  - facility_tasks: "Users can view tasks for accessible facilities" (also fixes wrong role casing)
  - deployment_organizations: insert, update, delete policies
  - deployment_projects: insert, update, delete policies
  - deployment_facilities: insert, update, delete policies
  - tracker_organizations: insert, update, delete policies
  - tracker_projects: insert, update, delete policies
  - tracker_facilities: insert, update, delete policies
*/

-- ============================================================
-- facilities
-- ============================================================
DROP POLICY IF EXISTS "Users can view facilities in accessible organizations" ON facilities;
CREATE POLICY "Users can view facilities in accessible organizations"
  ON facilities FOR SELECT TO authenticated
  USING (
    is_internal_user((SELECT auth.uid()))
    OR (organization_id IS NOT NULL AND user_can_access_organization((SELECT auth.uid()), organization_id))
  );

-- ============================================================
-- facility_tasks: fix old policy with wrong role casing and bare auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Users can view tasks for accessible facilities" ON facility_tasks;
CREATE POLICY "Users can view tasks for accessible facilities"
  ON facility_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = facility_tasks.facility_id
        AND (
          EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.role IN ('Proximity Admin', 'Proximity Staff')
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN user_organization_assignments uoa ON ur.user_id = uoa.user_id
            WHERE ur.user_id = (SELECT auth.uid())
              AND uoa.organization_id = f.organization_id
          )
        )
    )
  );

-- ============================================================
-- deployment_organizations
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert deployment orgs" ON deployment_organizations;
CREATE POLICY "Admins and managers can insert deployment orgs"
  ON deployment_organizations FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update deployment orgs" ON deployment_organizations;
CREATE POLICY "Admins and managers can update deployment orgs"
  ON deployment_organizations FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete deployment orgs" ON deployment_organizations;
CREATE POLICY "Admins can delete deployment orgs"
  ON deployment_organizations FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

-- ============================================================
-- deployment_projects
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert deployment projects" ON deployment_projects;
CREATE POLICY "Admins and managers can insert deployment projects"
  ON deployment_projects FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update deployment projects" ON deployment_projects;
CREATE POLICY "Admins and managers can update deployment projects"
  ON deployment_projects FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete deployment projects" ON deployment_projects;
CREATE POLICY "Admins can delete deployment projects"
  ON deployment_projects FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

-- ============================================================
-- deployment_facilities
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert deployment facilities" ON deployment_facilities;
CREATE POLICY "Admins and managers can insert deployment facilities"
  ON deployment_facilities FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update deployment facilities" ON deployment_facilities;
CREATE POLICY "Admins and managers can update deployment facilities"
  ON deployment_facilities FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete deployment facilities" ON deployment_facilities;
CREATE POLICY "Admins can delete deployment facilities"
  ON deployment_facilities FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

-- ============================================================
-- tracker_organizations
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker organizations" ON tracker_organizations;
CREATE POLICY "Admins and managers can insert tracker organizations"
  ON tracker_organizations FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update tracker organizations" ON tracker_organizations;
CREATE POLICY "Admins and managers can update tracker organizations"
  ON tracker_organizations FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete tracker organizations" ON tracker_organizations;
CREATE POLICY "Admins can delete tracker organizations"
  ON tracker_organizations FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

-- ============================================================
-- tracker_projects
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker projects" ON tracker_projects;
CREATE POLICY "Admins and managers can insert tracker projects"
  ON tracker_projects FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update tracker projects" ON tracker_projects;
CREATE POLICY "Admins and managers can update tracker projects"
  ON tracker_projects FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete tracker projects" ON tracker_projects;
CREATE POLICY "Admins can delete tracker projects"
  ON tracker_projects FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

-- ============================================================
-- tracker_facilities
-- ============================================================
DROP POLICY IF EXISTS "Admins and managers can insert tracker facilities" ON tracker_facilities;
CREATE POLICY "Admins and managers can insert tracker facilities"
  ON tracker_facilities FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins and managers can update tracker facilities" ON tracker_facilities;
CREATE POLICY "Admins and managers can update tracker facilities"
  ON tracker_facilities FOR UPDATE TO authenticated
  USING (is_admin_or_manager((SELECT auth.uid())))
  WITH CHECK (is_admin_or_manager((SELECT auth.uid())));

DROP POLICY IF EXISTS "Admins can delete tracker facilities" ON tracker_facilities;
CREATE POLICY "Admins can delete tracker facilities"
  ON tracker_facilities FOR DELETE TO authenticated
  USING (is_admin_user((SELECT auth.uid())));
