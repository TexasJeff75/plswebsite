
/*
  # Fix Customer Admin Write Access Across Facility Tables

  ## Summary
  Customer Admin users (is_internal = false, role = 'Customer Admin') were unable to
  modify records scoped to their assigned organizations due to several bugs:

  1. **facility_tasks**: Role strings were stored in snake_case ('customer_admin',
     'proximity_admin') but actual values in user_roles.role are Title Case
     ('Customer Admin', 'Proximity Admin'). All policies never matched.

  2. **facilities UPDATE**: WITH CHECK clause had a self-referencing typo:
     `uoa.organization_id = uoa.organization_id` (always true) instead of
     `uoa.organization_id = facilities.organization_id`.

  3. **milestone_tasks UPDATE/DELETE**: Customer Admin was not included — only
     Proximity Admin/Staff and the record creator/assignee had write access.

  4. **unified_documents UPDATE/DELETE**: Customer Admin was excluded — only
     uploaders and Proximity Admin could modify or delete.

  ## Changes

  ### facility_tasks (DROP + RECREATE all 4 policies)
  - Fix role casing in all policies
  - Customer Admin can INSERT, UPDATE, DELETE tasks for their org's facilities

  ### facilities (UPDATE policy only)
  - Fix WITH CHECK self-reference bug

  ### milestone_tasks (UPDATE + DELETE policies)
  - Add Customer Admin org-scoped access

  ### unified_documents (UPDATE + DELETE policies)
  - Add Customer Admin org-scoped access for facility and organization entity types
*/

-- ============================================================
-- 1. facility_tasks: DROP all broken policies and recreate
-- ============================================================

DROP POLICY IF EXISTS "Admins can delete tasks" ON facility_tasks;
DROP POLICY IF EXISTS "Users can create tasks for accessible facilities" ON facility_tasks;
DROP POLICY IF EXISTS "Users can update tasks they own or are assigned" ON facility_tasks;

-- Also drop the old select policy if it exists with wrong role casing
DROP POLICY IF EXISTS "All users can view tasks" ON facility_tasks;
DROP POLICY IF EXISTS "Users can view accessible tasks" ON facility_tasks;

CREATE POLICY "Users can view facility tasks for accessible facilities"
  ON facility_tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.is_internal = true
    )
    OR
    EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create facility tasks for accessible facilities"
  ON facility_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR
    EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Users can update facility tasks they own or admin"
  ON facility_tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Admins and creators can delete facility tasks"
  ON facility_tasks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = facility_tasks.facility_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- 2. facilities: Fix UPDATE WITH CHECK self-reference bug
-- ============================================================

DROP POLICY IF EXISTS "Users can update accessible facilities" ON facilities;

CREATE POLICY "Users can update accessible facilities"
  ON facilities
  FOR UPDATE
  TO authenticated
  USING (
    (is_internal_user() = true)
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = facilities.organization_id
    )
  )
  WITH CHECK (
    (is_internal_user() = true)
    OR EXISTS (
      SELECT 1
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE uoa.user_id = auth.uid()
        AND uoa.organization_id = facilities.organization_id
        AND ur.role = 'Customer Admin'
    )
  );

-- ============================================================
-- 3. milestone_tasks: Add Customer Admin to UPDATE and DELETE
-- ============================================================

DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON milestone_tasks;
DROP POLICY IF EXISTS "Task creators and admins can delete tasks" ON milestone_tasks;

CREATE POLICY "Users can update milestone tasks they own or admin"
  ON milestone_tasks
  FOR UPDATE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = auth.uid()
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = auth.uid()
          AND ur.role = 'Customer Admin'
      )
    )
  )
  WITH CHECK (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = auth.uid()
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = auth.uid()
          AND ur.role = 'Customer Admin'
      )
    )
  );

CREATE POLICY "Task creators and admins can delete milestone tasks"
  ON milestone_tasks
  FOR DELETE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR (
      facility_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = auth.uid()
        WHERE f.id = milestone_tasks.facility_id
          AND uoa.user_id = auth.uid()
          AND ur.role = 'Customer Admin'
      )
    )
  );

-- ============================================================
-- 4. unified_documents: Add Customer Admin to UPDATE and DELETE
-- ============================================================

DROP POLICY IF EXISTS "Users can update documents they uploaded or have admin rights" ON unified_documents;
DROP POLICY IF EXISTS "Admins and uploaders can delete documents" ON unified_documents;

CREATE POLICY "Users can update documents they uploaded or have admin rights"
  ON unified_documents
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'System Admin')
    )
    OR (
      entity_type = 'facility' AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization' AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'System Admin')
    )
    OR (
      entity_type = 'facility' AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization' AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );

CREATE POLICY "Admins and uploaders can delete documents"
  ON unified_documents
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('Proximity Admin', 'System Admin')
    )
    OR (
      entity_type = 'facility' AND EXISTS (
        SELECT 1
        FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE f.id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
    OR (
      entity_type = 'organization' AND EXISTS (
        SELECT 1
        FROM user_organization_assignments uoa
        JOIN user_roles ur ON ur.user_id = (SELECT auth.uid())
        WHERE uoa.organization_id = unified_documents.entity_id
          AND uoa.user_id = (SELECT auth.uid())
          AND ur.role = 'Customer Admin'
      )
    )
  );
