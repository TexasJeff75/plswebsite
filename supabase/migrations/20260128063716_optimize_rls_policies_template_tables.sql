/*
  # Optimize RLS Policies - Template Tables

  This migration optimizes RLS policies for template and catalog tables.

  ## Tables Updated:
  - deployment_templates
  - equipment_catalog
  - template_equipment
  - milestone_templates
  - template_milestones
  - test_catalog
  - site_equipment
  - site_test_menu
*/

-- =============================================
-- DEPLOYMENT_TEMPLATES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can create templates" ON deployment_templates;
DROP POLICY IF EXISTS "Admins can delete deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON deployment_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON deployment_templates;
DROP POLICY IF EXISTS "All authenticated users can read templates" ON deployment_templates;
DROP POLICY IF EXISTS "Internal users can manage deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Internal users can update deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Users can view accessible deployment templates" ON deployment_templates;

CREATE POLICY "Authenticated users can view templates"
  ON deployment_templates FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create templates"
  ON deployment_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update templates"
  ON deployment_templates FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete templates"
  ON deployment_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- EQUIPMENT_CATALOG TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can create equipment catalog items" ON equipment_catalog;
DROP POLICY IF EXISTS "Admins can delete equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Admins can delete equipment catalog items" ON equipment_catalog;
DROP POLICY IF EXISTS "Admins can update equipment catalog items" ON equipment_catalog;
DROP POLICY IF EXISTS "All authenticated users can read equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Internal users can manage equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Internal users can update equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Users can view accessible equipment catalog" ON equipment_catalog;

CREATE POLICY "Authenticated users can view equipment catalog"
  ON equipment_catalog FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create equipment catalog"
  ON equipment_catalog FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update equipment catalog"
  ON equipment_catalog FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete equipment catalog"
  ON equipment_catalog FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- TEMPLATE_EQUIPMENT TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Admins can manage template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Internal users can manage template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Internal users can update template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Users can view template equipment" ON template_equipment;
DROP POLICY IF EXISTS "All authenticated users can read template equipment" ON template_equipment;

CREATE POLICY "Authenticated users can view template equipment"
  ON template_equipment FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create template equipment"
  ON template_equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update template equipment"
  ON template_equipment FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete template equipment"
  ON template_equipment FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- MILESTONE_TEMPLATES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can create milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Admins can delete milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Admins can update milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "All authenticated users can read milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Internal users can manage milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Internal users can update milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Users can view accessible milestone templates" ON milestone_templates;

CREATE POLICY "Authenticated users can view milestone templates"
  ON milestone_templates FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create milestone templates"
  ON milestone_templates FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update milestone templates"
  ON milestone_templates FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete milestone templates"
  ON milestone_templates FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- TEMPLATE_MILESTONES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Admins can manage template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Internal users can manage template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Internal users can update template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Users can view template milestones" ON template_milestones;
DROP POLICY IF EXISTS "All authenticated users can read template milestones" ON template_milestones;

CREATE POLICY "Authenticated users can view template milestones"
  ON template_milestones FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create template milestones"
  ON template_milestones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update template milestones"
  ON template_milestones FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete template milestones"
  ON template_milestones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- TEST_CATALOG TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Admins can manage test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Authenticated users can view test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Internal users can manage test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Internal users can update test catalog" ON test_catalog;
DROP POLICY IF EXISTS "All authenticated users can read test catalog" ON test_catalog;

CREATE POLICY "Authenticated users can view test catalog"
  ON test_catalog FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can create test catalog"
  ON test_catalog FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update test catalog"
  ON test_catalog FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete test catalog"
  ON test_catalog FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- SITE_EQUIPMENT TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete site equipment" ON site_equipment;
DROP POLICY IF EXISTS "Staff can manage site equipment" ON site_equipment;
DROP POLICY IF EXISTS "Users can insert site equipment in accessible facilities" ON site_equipment;
DROP POLICY IF EXISTS "Users can read site equipment" ON site_equipment;
DROP POLICY IF EXISTS "Users can update site equipment in accessible facilities" ON site_equipment;
DROP POLICY IF EXISTS "Users can view site equipment in accessible facilities" ON site_equipment;

CREATE POLICY "Users can view site equipment"
  ON site_equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_equipment.site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert site equipment"
  ON site_equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update site equipment"
  ON site_equipment FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_equipment.site_id
      AND uoa.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete site equipment"
  ON site_equipment FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- SITE_TEST_MENU TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete site test menu" ON site_test_menu;
DROP POLICY IF EXISTS "Staff can manage site test menu" ON site_test_menu;
DROP POLICY IF EXISTS "Users can insert site test menu in accessible facilities" ON site_test_menu;
DROP POLICY IF EXISTS "Users can read site test menu" ON site_test_menu;
DROP POLICY IF EXISTS "Users can update site test menu in accessible facilities" ON site_test_menu;
DROP POLICY IF EXISTS "Users can view site test menu in accessible facilities" ON site_test_menu;

CREATE POLICY "Users can view site test menu"
  ON site_test_menu FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_test_menu.site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert site test menu"
  ON site_test_menu FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update site test menu"
  ON site_test_menu FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_test_menu.site_id
      AND uoa.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete site test menu"
  ON site_test_menu FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );
