/*
  # Optimize RLS Policies - Facility Info Tables

  This migration optimizes RLS policies for facility info tables.

  ## Tables Updated:
  - regulatory_info
  - personnel_info
  - trained_personnel
  - facility_readiness_info
  - training_info
  - integration_info
  - interface_status
  - responsibilities
*/

-- =============================================
-- REGULATORY_INFO TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert facility regulatory info" ON regulatory_info;
DROP POLICY IF EXISTS "Editors can update facility regulatory info" ON regulatory_info;
DROP POLICY IF EXISTS "Internal users can delete regulatory info" ON regulatory_info;
DROP POLICY IF EXISTS "Staff can modify regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Users can insert regulatory info in accessible facilities" ON regulatory_info;
DROP POLICY IF EXISTS "Users can read facility regulatory info" ON regulatory_info;
DROP POLICY IF EXISTS "Users can read regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Users can update regulatory info in accessible facilities" ON regulatory_info;
DROP POLICY IF EXISTS "Users can view regulatory info in accessible facilities" ON regulatory_info;

CREATE POLICY "Users can view regulatory info"
  ON regulatory_info FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = regulatory_info.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert regulatory info"
  ON regulatory_info FOR INSERT TO authenticated
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

CREATE POLICY "Users can update regulatory info"
  ON regulatory_info FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = regulatory_info.facility_id
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

CREATE POLICY "Internal users can delete regulatory info"
  ON regulatory_info FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- PERSONNEL_INFO TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert personnel info" ON personnel_info;
DROP POLICY IF EXISTS "Editors can update personnel info" ON personnel_info;
DROP POLICY IF EXISTS "Internal users can delete personnel info" ON personnel_info;
DROP POLICY IF EXISTS "Staff can modify personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Users can insert personnel info in accessible facilities" ON personnel_info;
DROP POLICY IF EXISTS "Users can read facility personnel info" ON personnel_info;
DROP POLICY IF EXISTS "Users can read personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Users can update personnel info in accessible facilities" ON personnel_info;
DROP POLICY IF EXISTS "Users can view personnel info in accessible facilities" ON personnel_info;

CREATE POLICY "Users can view personnel info"
  ON personnel_info FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = personnel_info.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert personnel info"
  ON personnel_info FOR INSERT TO authenticated
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

CREATE POLICY "Users can update personnel info"
  ON personnel_info FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = personnel_info.facility_id
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

CREATE POLICY "Internal users can delete personnel info"
  ON personnel_info FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- TRAINED_PERSONNEL TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can delete trained personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Editors can insert trained personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Editors can update trained personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Internal users can delete trained personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Staff can modify trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Users can insert trained personnel in accessible facilities" ON trained_personnel;
DROP POLICY IF EXISTS "Users can read facility trained personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Users can read trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Users can update trained personnel in accessible facilities" ON trained_personnel;
DROP POLICY IF EXISTS "Users can view trained personnel in accessible facilities" ON trained_personnel;

CREATE POLICY "Users can view trained personnel"
  ON trained_personnel FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = trained_personnel.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert trained personnel"
  ON trained_personnel FOR INSERT TO authenticated
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

CREATE POLICY "Users can update trained personnel"
  ON trained_personnel FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = trained_personnel.facility_id
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

CREATE POLICY "Internal users can delete trained personnel"
  ON trained_personnel FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- FACILITY_READINESS_INFO TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert facility readiness info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Editors can update facility readiness info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Internal users can delete readiness info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Staff can modify facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can insert readiness info in accessible facilities" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can read facility readiness info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can read facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can update readiness info in accessible facilities" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can view readiness info in accessible facilities" ON facility_readiness_info;

CREATE POLICY "Users can view facility readiness info"
  ON facility_readiness_info FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_readiness_info.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert facility readiness info"
  ON facility_readiness_info FOR INSERT TO authenticated
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

CREATE POLICY "Users can update facility readiness info"
  ON facility_readiness_info FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_readiness_info.facility_id
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

CREATE POLICY "Internal users can delete facility readiness info"
  ON facility_readiness_info FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- TRAINING_INFO TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert training info" ON training_info;
DROP POLICY IF EXISTS "Editors can update training info" ON training_info;
DROP POLICY IF EXISTS "Internal users can delete training info" ON training_info;
DROP POLICY IF EXISTS "Staff can modify training_info" ON training_info;
DROP POLICY IF EXISTS "Users can insert training info in accessible facilities" ON training_info;
DROP POLICY IF EXISTS "Users can read facility training info" ON training_info;
DROP POLICY IF EXISTS "Users can read training_info" ON training_info;
DROP POLICY IF EXISTS "Users can update training info in accessible facilities" ON training_info;
DROP POLICY IF EXISTS "Users can view training info in accessible facilities" ON training_info;

CREATE POLICY "Users can view training info"
  ON training_info FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = training_info.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert training info"
  ON training_info FOR INSERT TO authenticated
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

CREATE POLICY "Users can update training info"
  ON training_info FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = training_info.facility_id
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

CREATE POLICY "Internal users can delete training info"
  ON training_info FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- INTEGRATION_INFO TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert integration info" ON integration_info;
DROP POLICY IF EXISTS "Editors can update integration info" ON integration_info;
DROP POLICY IF EXISTS "Internal users can delete integration info" ON integration_info;
DROP POLICY IF EXISTS "Staff can modify integration_info" ON integration_info;
DROP POLICY IF EXISTS "Users can insert integration info in accessible facilities" ON integration_info;
DROP POLICY IF EXISTS "Users can read facility integration info" ON integration_info;
DROP POLICY IF EXISTS "Users can read integration_info" ON integration_info;
DROP POLICY IF EXISTS "Users can update integration info in accessible facilities" ON integration_info;
DROP POLICY IF EXISTS "Users can view integration info in accessible facilities" ON integration_info;

CREATE POLICY "Users can view integration info"
  ON integration_info FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = integration_info.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert integration info"
  ON integration_info FOR INSERT TO authenticated
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

CREATE POLICY "Users can update integration info"
  ON integration_info FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = integration_info.facility_id
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

CREATE POLICY "Internal users can delete integration info"
  ON integration_info FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- INTERFACE_STATUS TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can insert interface status" ON interface_status;
DROP POLICY IF EXISTS "Editors can update interface status" ON interface_status;
DROP POLICY IF EXISTS "Internal users can delete interface status" ON interface_status;
DROP POLICY IF EXISTS "Staff can modify interface_status" ON interface_status;
DROP POLICY IF EXISTS "Users can insert interface status" ON interface_status;
DROP POLICY IF EXISTS "Users can read interface status" ON interface_status;
DROP POLICY IF EXISTS "Users can read interface_status" ON interface_status;
DROP POLICY IF EXISTS "Users can update interface status" ON interface_status;
DROP POLICY IF EXISTS "Users can view interface status" ON interface_status;

CREATE POLICY "Users can view interface status"
  ON interface_status FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM integration_info ii
      JOIN facilities f ON f.id = ii.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ii.id = interface_status.integration_info_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert interface status"
  ON interface_status FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM integration_info ii
      JOIN facilities f ON f.id = ii.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ii.id = integration_info_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update interface status"
  ON interface_status FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM integration_info ii
      JOIN facilities f ON f.id = ii.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ii.id = interface_status.integration_info_id
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
      SELECT 1 FROM integration_info ii
      JOIN facilities f ON f.id = ii.facility_id
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE ii.id = integration_info_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete interface status"
  ON interface_status FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- RESPONSIBILITIES TABLE
-- =============================================
DROP POLICY IF EXISTS "Editors can delete responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Editors can insert responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Internal users can delete responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Users can insert responsibilities in accessible facilities" ON responsibilities;
DROP POLICY IF EXISTS "Users can update responsibilities in accessible facilities" ON responsibilities;
DROP POLICY IF EXISTS "Users can view responsibilities in accessible facilities" ON responsibilities;

CREATE POLICY "Users can view responsibilities"
  ON responsibilities FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = responsibilities.facility_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert responsibilities"
  ON responsibilities FOR INSERT TO authenticated
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

CREATE POLICY "Users can update responsibilities"
  ON responsibilities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = responsibilities.facility_id
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

CREATE POLICY "Internal users can delete responsibilities"
  ON responsibilities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );
