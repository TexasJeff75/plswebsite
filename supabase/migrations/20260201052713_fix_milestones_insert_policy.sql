/*
  # Fix Milestones INSERT Policy

  1. Changes
    - Add WITH CHECK clause to milestone policy to allow INSERTs
    - This fixes the silent failure when creating new milestones
  
  2. Security
    - Maintains existing access control
    - Staff members can insert milestones for any facility
*/

-- Drop and recreate the milestone policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "Staff can modify milestones" ON milestones;

CREATE POLICY "Staff can modify milestones"
  ON milestones FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Customer Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Customer Admin')
    )
  );
