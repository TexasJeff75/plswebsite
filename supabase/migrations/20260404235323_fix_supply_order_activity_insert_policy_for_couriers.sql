/*
  # Fix supply_order_activity INSERT policy for couriers

  ## Problem
  The existing INSERT policy requires `actor_user_id = auth.uid()`, which fails when:
  - The courier confirms pickup/delivery via QR scan (actor_user_id may be null or the courier's uid)
  - The system logs activity on behalf of a courier

  ## Changes
  - Drop the restrictive INSERT policy
  - Replace with one that allows insert when:
    - actor_user_id matches the authenticated user, OR
    - actor_user_id is null (system/anonymous events)
    - AND the order exists and is accessible
*/

DROP POLICY IF EXISTS "Authenticated users can log activity" ON supply_order_activity;

CREATE POLICY "Users can log activity for accessible orders"
  ON supply_order_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (actor_user_id = auth.uid() OR actor_user_id IS NULL)
    AND EXISTS (
      SELECT 1 FROM supply_orders so
      WHERE so.id = order_id
      AND (
        so.organization_id IN (
          SELECT organization_id FROM user_organization_assignments
          WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_id = auth.uid()
          AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin', 'Courier')
        )
        OR EXISTS (
          SELECT 1 FROM supply_deliveries sd
          WHERE sd.order_id = supply_order_activity.order_id
          AND sd.assigned_courier_user_id = auth.uid()
        )
      )
    )
  );
