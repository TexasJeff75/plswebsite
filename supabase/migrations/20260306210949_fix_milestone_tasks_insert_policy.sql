/*
  # Fix Milestone Tasks Insert Policy

  1. Changes
    - Simplify INSERT policy to allow authenticated users to create tasks for facilities they can access
    - The policy was failing because the WITH CHECK was too complex and had issues with the join logic

  2. Security
    - Users can create tasks for facilities in organizations they're assigned to
    - Admins can create tasks for any facility
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create tasks for accessible facilities" ON milestone_tasks;

-- Create simplified policy
CREATE POLICY "Users can create tasks for accessible facilities"
  ON milestone_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins can create tasks for any facility
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('proximity_admin', 'proximity_staff')
    )
    OR
    -- Users can create tasks for facilities in their assigned organizations
    facility_id IN (
      SELECT f.id
      FROM facilities f
      INNER JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      INNER JOIN user_roles ur ON ur.id = uoa.user_id
      WHERE ur.user_id = auth.uid()
    )
  );