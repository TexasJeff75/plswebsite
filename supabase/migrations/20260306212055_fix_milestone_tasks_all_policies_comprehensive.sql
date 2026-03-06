/*
  # Fix All Milestone Tasks RLS Policies Comprehensively

  1. Changes
    - Recreate ALL policies with correct role casing and simplified logic
    - Use consistent pattern across all policies
    - Fix SELECT policy that still had lowercase roles

  2. Security
    - Proximity Admin and Proximity Staff can access all tasks
    - Users can access tasks for facilities in their assigned organizations
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view tasks for accessible facilities" ON milestone_tasks;
DROP POLICY IF EXISTS "Users can create tasks for accessible facilities" ON milestone_tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON milestone_tasks;
DROP POLICY IF EXISTS "Task creators and admins can delete tasks" ON milestone_tasks;

-- SELECT: View tasks for accessible facilities
CREATE POLICY "Users can view tasks for accessible facilities"
  ON milestone_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR
    facility_id IN (
      SELECT f.id
      FROM facilities f
      INNER JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      INNER JOIN user_roles ur ON ur.id = uoa.user_id
      WHERE ur.user_id = auth.uid()
    )
  );

-- INSERT: Create tasks for accessible facilities
CREATE POLICY "Users can create tasks for accessible facilities"
  ON milestone_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR
    facility_id IN (
      SELECT f.id
      FROM facilities f
      INNER JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      INNER JOIN user_roles ur ON ur.id = uoa.user_id
      WHERE ur.user_id = auth.uid()
    )
  );

-- UPDATE: Update own tasks or tasks assigned to you or admin
CREATE POLICY "Users can update tasks they created or are assigned to"
  ON milestone_tasks FOR UPDATE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
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
  );

-- DELETE: Delete own tasks or admin
CREATE POLICY "Task creators and admins can delete tasks"
  ON milestone_tasks FOR DELETE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );