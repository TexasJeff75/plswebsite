/*
  # Fix supply_orders INSERT policy for Proximity Staff

  ## Problem
  The only INSERT policy on supply_orders requires the user to be assigned to
  the order's organization AND sets requested_by = auth.uid(). This blocks
  Proximity Staff from creating orders on behalf of facilities/orgs they manage.

  ## Changes
  - Add a new INSERT policy allowing Proximity Staff roles to create any order
*/

CREATE POLICY "Proximity staff can create orders"
  ON supply_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'Proximity Admin',
          'Proximity Staff',
          'Account Manager',
          'Technical Consultant',
          'Compliance Specialist',
          'Super Admin'
        ])
    )
  );
