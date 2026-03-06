/*
  # Update Task Delete Policy

  1. Changes
    - Update DELETE policy to allow both admins AND task creators to delete tasks
    - This gives users control over their own tasks while maintaining admin oversight

  2. Security
    - Users can delete tasks they created
    - Admins can delete any task
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Only admins can delete tasks" ON milestone_tasks;

-- Create new policy allowing creators and admins to delete
CREATE POLICY "Task creators and admins can delete tasks"
  ON milestone_tasks FOR DELETE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('proximity_admin', 'proximity_staff')
    )
  );