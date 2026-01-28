/*
  # Optimize RLS Policies - Facility Tables

  This migration optimizes RLS policies for facility-related tables by using
  (select auth.uid()) pattern for better performance at scale.

  ## Tables Updated:
  - facilities
  - milestones
  - notes
  - documents
  - equipment
  - activity_log
*/

-- =============================================
-- FACILITIES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete facilities" ON facilities;
DROP POLICY IF EXISTS "Customers can read their organization facilities" ON facilities;
DROP POLICY IF EXISTS "Internal users can delete facilities" ON facilities;
DROP POLICY IF EXISTS "Staff can insert facilities" ON facilities;
DROP POLICY IF EXISTS "Staff can read all facilities" ON facilities;
DROP POLICY IF EXISTS "Staff can update facilities" ON facilities;
DROP POLICY IF EXISTS "Users can create facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Users can update facilities in accessible organizations" ON facilities;
DROP POLICY IF EXISTS "Users can view facilities in accessible organizations" ON facilities;

CREATE POLICY "Users can view accessible facilities"
  ON facilities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = facilities.organization_id
    )
  );

CREATE POLICY "Internal users can create facilities"
  ON facilities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organization_id
      AND uoa.role IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Users can update accessible facilities"
  ON facilities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = facilities.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organization_id
    )
  );

CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- MILESTONES TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete milestones" ON milestones;
DROP POLICY IF EXISTS "Staff can modify milestones" ON milestones;
DROP POLICY IF EXISTS "Users can insert milestones in accessible facilities" ON milestones;
DROP POLICY IF EXISTS "Users can read milestones" ON milestones;
DROP POLICY IF EXISTS "Users can update milestones in accessible facilities" ON milestones;
DROP POLICY IF EXISTS "Users can view milestones in accessible facilities" ON milestones;

CREATE POLICY "Users can view milestones"
  ON milestones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert milestones"
  ON milestones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update milestones"
  ON milestones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = milestones.facility_id
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
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete milestones"
  ON milestones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- NOTES TABLE
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON notes;
DROP POLICY IF EXISTS "Internal users can delete notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert notes in accessible facilities" ON notes;
DROP POLICY IF EXISTS "Users can update notes in accessible facilities" ON notes;
DROP POLICY IF EXISTS "Users can view notes in accessible facilities" ON notes;

CREATE POLICY "Users can view notes"
  ON notes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = notes.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert notes"
  ON notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update notes"
  ON notes FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  )
  WITH CHECK (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete documents" ON documents;
DROP POLICY IF EXISTS "Staff can modify documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents in accessible facilities" ON documents;
DROP POLICY IF EXISTS "Users can read documents" ON documents;
DROP POLICY IF EXISTS "Users can update documents in accessible facilities" ON documents;
DROP POLICY IF EXISTS "Users can view documents in accessible facilities" ON documents;

CREATE POLICY "Users can view documents"
  ON documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert documents"
  ON documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update documents"
  ON documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = documents.facility_id
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
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete documents"
  ON documents FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- EQUIPMENT TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete equipment" ON equipment;
DROP POLICY IF EXISTS "Staff can modify equipment" ON equipment;
DROP POLICY IF EXISTS "Users can insert equipment in accessible facilities" ON equipment;
DROP POLICY IF EXISTS "Users can read equipment" ON equipment;
DROP POLICY IF EXISTS "Users can update equipment in accessible facilities" ON equipment;
DROP POLICY IF EXISTS "Users can view equipment in accessible facilities" ON equipment;

CREATE POLICY "Users can view equipment"
  ON equipment FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert equipment"
  ON equipment FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update equipment"
  ON equipment FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = equipment.facility_id
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
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete equipment"
  ON equipment FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- ACTIVITY_LOG TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert activity log" ON activity_log;
DROP POLICY IF EXISTS "Internal users can delete activity log" ON activity_log;
DROP POLICY IF EXISTS "Internal users can update activity log" ON activity_log;
DROP POLICY IF EXISTS "Users can insert activity log in accessible facilities" ON activity_log;
DROP POLICY IF EXISTS "Users can view activity log in accessible facilities" ON activity_log;
DROP POLICY IF EXISTS "Users can read activity log" ON activity_log;

CREATE POLICY "Users can view activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = activity_log.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert activity log"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can update activity log"
  ON activity_log FOR UPDATE TO authenticated
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

CREATE POLICY "Internal users can delete activity log"
  ON activity_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );
