/*
  # Fix infinite recursion in supply_orders RLS for courier updates

  ## Problem
  The "Couriers can mark their assigned orders as delivered" UPDATE policy on
  supply_orders queries supply_deliveries. The supply_deliveries SELECT policy
  for customers joins back to supply_orders, creating a circular RLS evaluation
  loop → "Infinite recursion detected in policy for relation supply_orders".

  ## Solution
  Create a SECURITY DEFINER function that checks courier assignment without
  triggering RLS, then use that function in the policy.

  ## Changes
  - Add helper function `is_courier_assigned_to_order(order_id uuid)` (security definer)
  - Drop and recreate the courier UPDATE policy using this function
*/

CREATE OR REPLACE FUNCTION is_courier_assigned_to_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM supply_deliveries sd
    WHERE sd.order_id = p_order_id
      AND sd.assigned_courier_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Couriers can mark their assigned orders as delivered" ON supply_orders;

CREATE POLICY "Couriers can mark their assigned orders as delivered"
  ON supply_orders
  FOR UPDATE
  TO authenticated
  USING (is_courier_assigned_to_order(id))
  WITH CHECK (
    status = 'delivered'
    AND is_courier_assigned_to_order(id)
  );
