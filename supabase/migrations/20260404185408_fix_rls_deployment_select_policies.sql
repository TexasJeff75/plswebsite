/*
  # Fix RLS Auth Initialization - Deployment SELECT Policies

  ## Summary
  Fixes remaining bare auth.uid() calls in deployment table SELECT policies.
  These functions accept uid as a parameter — wrapping in (SELECT ...) ensures
  the value is computed once per query.

  ## Tables fixed
  - deployment_organizations SELECT
  - deployment_projects SELECT
  - deployment_facilities SELECT
*/

DROP POLICY IF EXISTS "Authenticated users can view deployment orgs they have access t" ON deployment_organizations;
CREATE POLICY "Authenticated users can view deployment orgs they have access to"
  ON deployment_organizations FOR SELECT TO authenticated
  USING (
    is_internal_user((SELECT auth.uid()))
    OR id IN (SELECT unnest(get_user_organization_ids((SELECT auth.uid()))))
  );

DROP POLICY IF EXISTS "Authenticated users can view deployment projects they have acce" ON deployment_projects;
CREATE POLICY "Authenticated users can view deployment projects they have access to"
  ON deployment_projects FOR SELECT TO authenticated
  USING (
    is_internal_user((SELECT auth.uid()))
    OR organization_id IN (SELECT unnest(get_user_organization_ids((SELECT auth.uid()))))
  );

DROP POLICY IF EXISTS "Authenticated users can view deployment facilities they have ac" ON deployment_facilities;
CREATE POLICY "Authenticated users can view deployment facilities they have access to"
  ON deployment_facilities FOR SELECT TO authenticated
  USING (
    is_internal_user((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM deployment_projects dp
      WHERE dp.id = deployment_facilities.project_id
        AND dp.organization_id IN (SELECT unnest(get_user_organization_ids((SELECT auth.uid()))))
    )
  );
