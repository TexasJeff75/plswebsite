/*
  # Fix all RLS policies to prevent infinite recursion

  1. Overview
    - All RLS policies that query user_roles cause infinite recursion
    - Replace all user_roles queries with is_internal_user() security definer function
    - This migration updates ALL affected policies across the database

  2. Security
    - Uses security definer function to bypass RLS and prevent recursion
    - Maintains same permission logic without infinite loops
*/

-- ==============================================================================
-- FACILITIES TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can delete facilities" ON facilities;
CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can create facilities" ON facilities;
CREATE POLICY "Internal users can create facilities"
  ON facilities FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = organization_id
        AND uoa.role IN ('Admin', 'Manager')
    )
  );

DROP POLICY IF EXISTS "Users can update accessible facilities" ON facilities;
CREATE POLICY "Users can update accessible facilities"
  ON facilities FOR UPDATE TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = facilities.organization_id
    )
  )
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can view accessible facilities" ON facilities;
CREATE POLICY "Users can view accessible facilities"
  ON facilities FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = facilities.organization_id
    )
  );

-- ==============================================================================
-- ORGANIZATIONS TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;
CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can create organizations" ON organizations;
CREATE POLICY "Internal users can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can update accessible organizations" ON organizations;
CREATE POLICY "Users can update accessible organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = organizations.id
        AND uoa.role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = id
        AND uoa.role IN ('Admin', 'Manager')
    )
  );

DROP POLICY IF EXISTS "Users can view accessible organizations" ON organizations;
CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = organizations.id
    )
  );

-- ==============================================================================
-- PROJECTS TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Internal users can read all projects" ON projects;
CREATE POLICY "Internal users can read all projects"
  ON projects FOR SELECT TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins and editors can insert projects" ON projects;
CREATE POLICY "Admins and editors can insert projects"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins and editors can update projects" ON projects;
CREATE POLICY "Admins and editors can update projects"
  ON projects FOR UPDATE TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can delete projects" ON projects;
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

-- ==============================================================================
-- MILESTONES TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Internal users can delete milestones" ON milestones;
CREATE POLICY "Internal users can delete milestones"
  ON milestones FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can insert milestones" ON milestones;
CREATE POLICY "Users can insert milestones"
  ON milestones FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update milestones" ON milestones;
CREATE POLICY "Users can update milestones"
  ON milestones FOR UPDATE TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
        AND uoa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view milestones" ON milestones;
CREATE POLICY "Users can view milestones"
  ON milestones FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- EQUIPMENT TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Internal users can delete equipment" ON equipment;
CREATE POLICY "Internal users can delete equipment"
  ON equipment FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can insert equipment" ON equipment;
CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update equipment" ON equipment;
CREATE POLICY "Users can update equipment"
  ON equipment FOR UPDATE TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
        AND uoa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view equipment" ON equipment;
CREATE POLICY "Users can view equipment"
  ON equipment FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- DOCUMENTS TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Internal users can delete documents" ON documents;
CREATE POLICY "Internal users can delete documents"
  ON documents FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can insert documents" ON documents;
CREATE POLICY "Users can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update documents" ON documents;
CREATE POLICY "Users can update documents"
  ON documents FOR UPDATE TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
        AND uoa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view documents" ON documents;
CREATE POLICY "Users can view documents"
  ON documents FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- NOTES TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can insert notes" ON notes;
CREATE POLICY "Users can insert notes"
  ON notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = notes.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update notes" ON notes;
CREATE POLICY "Users can update notes"
  ON notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_internal_user() = true)
  WITH CHECK (created_by = auth.uid() OR public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can view notes" ON notes;
CREATE POLICY "Users can view notes"
  ON notes FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = notes.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- ACTIVITY_LOG TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Internal users can delete activity log" ON activity_log;
CREATE POLICY "Internal users can delete activity log"
  ON activity_log FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can update activity log" ON activity_log;
CREATE POLICY "Internal users can update activity log"
  ON activity_log FOR UPDATE TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Users can insert activity log" ON activity_log;
CREATE POLICY "Users can insert activity log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = activity_log.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view activity log" ON activity_log;
CREATE POLICY "Users can view activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (
    public.is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = activity_log.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

-- ==============================================================================
-- REFERENCE_DATA TABLE
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can delete reference data" ON reference_data;
CREATE POLICY "Admins can delete reference data"
  ON reference_data FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can manage reference data" ON reference_data;
CREATE POLICY "Internal users can manage reference data"
  ON reference_data FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can update reference data" ON reference_data;
CREATE POLICY "Internal users can update reference data"
  ON reference_data FOR UPDATE TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can view reference data audit" ON reference_data_audit;
CREATE POLICY "Internal users can view reference data audit"
  ON reference_data_audit FOR SELECT TO authenticated
  USING (public.is_internal_user() = true);

-- ==============================================================================
-- TEMPLATES AND CATALOG TABLES
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can delete templates" ON deployment_templates;
CREATE POLICY "Admins can delete templates"
  ON deployment_templates FOR DELETE TO authenticated
  USING (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can create templates" ON deployment_templates;
CREATE POLICY "Internal users can create templates"
  ON deployment_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Internal users can update templates" ON deployment_templates;
CREATE POLICY "Internal users can update templates"
  ON deployment_templates FOR UPDATE TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

-- ==============================================================================
-- LAB AND STRATUS TABLES
-- ==============================================================================
DROP POLICY IF EXISTS "Admins can manage all lab orders" ON lab_orders;
CREATE POLICY "Admins can manage all lab orders"
  ON lab_orders FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all lab confirmations" ON lab_order_confirmations;
CREATE POLICY "Admins can manage all lab confirmations"
  ON lab_order_confirmations FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all lab results" ON lab_results;
CREATE POLICY "Admins can manage all lab results"
  ON lab_results FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all StratusDX orders" ON stratus_orders;
CREATE POLICY "Admins can manage all StratusDX orders"
  ON stratus_orders FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all StratusDX confirmations" ON stratus_confirmations;
CREATE POLICY "Admins can manage all StratusDX confirmations"
  ON stratus_confirmations FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all StratusDX results" ON stratus_results;
CREATE POLICY "Admins can manage all StratusDX results"
  ON stratus_results FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage all StratusDX mappings" ON stratus_facility_mappings;
CREATE POLICY "Admins can manage all StratusDX mappings"
  ON stratus_facility_mappings FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage StratusDX organizations" ON stratus_organizations;
CREATE POLICY "Admins can manage StratusDX organizations"
  ON stratus_organizations FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);

DROP POLICY IF EXISTS "Admins can manage StratusDX test methods" ON stratus_test_methods;
CREATE POLICY "Admins can manage StratusDX test methods"
  ON stratus_test_methods FOR ALL TO authenticated
  USING (public.is_internal_user() = true)
  WITH CHECK (public.is_internal_user() = true);
