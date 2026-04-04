/*
  # Allow assigned couriers (any role) to view order items for their deliveries

  ## Problem
  Customer users (Customer Admin / Customer Viewer) can now be assigned as couriers
  to facilities. When they pick up a delivery, they need to see the order items.
  
  The existing supply_order_items SELECT policy only covers org-assigned users and
  Proximity staff. A dedicated Courier-role user who is not org-assigned also needs
  access to items for their assigned deliveries.

  ## Changes
  - Add SELECT policy on supply_order_items allowing any user assigned as the
    delivery courier to view items for that order
*/

CREATE POLICY "Assigned couriers can view order items for their deliveries"
  ON supply_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM supply_deliveries sd
      WHERE sd.order_id = supply_order_items.order_id
        AND sd.assigned_courier_user_id = auth.uid()
    )
  );
