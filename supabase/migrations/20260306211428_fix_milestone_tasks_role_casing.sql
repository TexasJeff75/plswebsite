/*
  # Fix Milestone Tasks Role Casing

  1. Changes
    - Update INSERT policy to use correct role casing: 'Proximity Admin' and 'Proximity Staff'
    - The roles in the database use title case, not lowercase

  2. Security
    - Admins and staff can create tasks for any facility
    - Users can create tasks for facilities in their assigned organizations
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create tasks for accessible facilities" ON milestone_tasks;

-- Create policy with correct role casing
CREATE POLICY "Users can create tasks for accessible facilities"
  ON milestone_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admins and staff can create tasks for any facility
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
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