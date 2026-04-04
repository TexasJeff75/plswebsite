/*
  # Fix Courier Delivery Update Permissions

  ## Problem
  Couriers cannot update supply_orders status to 'delivered' because the existing
  UPDATE RLS policy on supply_orders only allows proximity staff and customer admins.
  When a courier confirms delivery via the QR code flow, it calls
  supplyOrdersService.updateStatus() which fails silently due to RLS.

  ## Changes
  1. Add UPDATE policy on supply_orders for couriers assigned to the delivery
  2. Restrict this policy to only allow setting status = 'delivered'
*/

CREATE POLICY "Couriers can mark their assigned orders as delivered"
  ON supply_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM supply_deliveries sd
      WHERE sd.order_id = supply_orders.id
        AND sd.assigned_courier_user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'delivered'
    AND EXISTS (
      SELECT 1 FROM supply_deliveries sd
      WHERE sd.order_id = supply_orders.id
        AND sd.assigned_courier_user_id = auth.uid()
    )
  );
