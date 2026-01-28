/*
  # Optimize RLS Policies - Core Tables

  This migration optimizes RLS policies by replacing auth.uid() with (select auth.uid())
  to prevent re-evaluation for each row, improving query performance at scale.

  ## Tables Updated:
  - notifications
  - reference_data
  - reference_data_audit
  - user_organization_assignments
  - user_roles
*/

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- =============================================
-- REFERENCE_DATA TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete reference data" ON reference_data;
DROP POLICY IF EXISTS "Authenticated users can view reference data" ON reference_data;
DROP POLICY IF EXISTS "Internal users can manage reference data" ON reference_data;
DROP POLICY IF EXISTS "Internal users can update reference data" ON reference_data;
DROP POLICY IF EXISTS "Reference data deletable by admin" ON reference_data;
DROP POLICY IF EXISTS "Reference data insertable by admin" ON reference_data;
DROP POLICY IF EXISTS "Reference data updatable by admin" ON reference_data;
DROP POLICY IF EXISTS "Reference data readable by authenticated" ON reference_data;

CREATE POLICY "Authenticated users can view reference data"
  ON reference_data FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can manage reference data"
  ON reference_data FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Internal users can update reference data"
  ON reference_data FOR UPDATE TO authenticated
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

CREATE POLICY "Admins can delete reference data"
  ON reference_data FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- REFERENCE_DATA_AUDIT TABLE
-- =============================================
DROP POLICY IF EXISTS "Audit insertable by admin" ON reference_data_audit;
DROP POLICY IF EXISTS "Audit readable by admin" ON reference_data_audit;
DROP POLICY IF EXISTS "Authenticated users can insert audit records" ON reference_data_audit;
DROP POLICY IF EXISTS "Internal users can view reference data audit" ON reference_data_audit;

CREATE POLICY "Internal users can view reference data audit"
  ON reference_data_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Authenticated users can insert audit records"
  ON reference_data_audit FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =============================================
-- USER_ORGANIZATION_ASSIGNMENTS TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can create assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Admins and managers can update assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON user_organization_assignments;
DROP POLICY IF EXISTS "Users can view organization assignments" ON user_organization_assignments;

CREATE POLICY "Users can view organization assignments"
  ON user_organization_assignments FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Admins and managers can create assignments"
  ON user_organization_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND (user_roles.role IN ('Proximity Admin', 'Account Manager') OR user_roles.is_internal = true)
    )
  );

CREATE POLICY "Admins and managers can update assignments"
  ON user_organization_assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND (user_roles.role IN ('Proximity Admin', 'Account Manager') OR user_roles.is_internal = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND (user_roles.role IN ('Proximity Admin', 'Account Manager') OR user_roles.is_internal = true)
    )
  );

CREATE POLICY "Admins can delete assignments"
  ON user_organization_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- USER_ROLES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins and managers can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Proximity staff can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Proximity staff can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Proximity staff can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update own record by email" ON user_roles;
DROP POLICY IF EXISTS "Users can view accessible user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read all user roles" ON user_roles;

CREATE POLICY "Users can read all user roles"
  ON user_roles FOR SELECT TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Internal users can insert user roles"
  ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  );

CREATE POLICY "Internal users can update user roles"
  ON user_roles FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.is_internal = true
    )
  );

CREATE POLICY "Admins can delete user roles"
  ON user_roles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = (select auth.uid())
      AND ur.role = 'Proximity Admin'
    )
  );
