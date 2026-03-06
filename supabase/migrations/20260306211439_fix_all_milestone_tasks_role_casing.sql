/*
  # Fix All Milestone Tasks Policies Role Casing

  1. Changes
    - Update DELETE and UPDATE policies to use correct role casing
    - The roles in the database use title case: 'Proximity Admin' and 'Proximity Staff'

  2. Security
    - Maintains existing security model with correct role matching
*/

-- Fix DELETE policy
DROP POLICY IF EXISTS "Task creators and admins can delete tasks" ON milestone_tasks;

CREATE POLICY "Task creators and admins can delete tasks"
  ON milestone_tasks FOR DELETE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON milestone_tasks;

CREATE POLICY "Users can update tasks they created or are assigned to"
  ON milestone_tasks FOR UPDATE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );