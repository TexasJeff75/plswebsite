/*
  # Allow Customer Admin to Dispatch Supply Orders

  ## Summary
  Grants Customer Admins the ability to dispatch supply orders for their own organization.
  Previously, only Proximity staff could insert/update supply_deliveries records,
  which is required for the dispatch action.

  ## Changes

  ### supply_deliveries table
  - Added INSERT policy for Customer Admins scoped to their organization's orders
  - Added UPDATE policy for Customer Admins scoped to their organization's orders

  ## Security Notes
  - Customer Admins can only insert/update deliveries for orders belonging to
    their own organization (checked via user_organization_assignments)
  - Proximity staff policies remain unchanged and unaffected
*/

CREATE POLICY "Customer admins can create deliveries for their org orders"
  ON supply_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM supply_orders so
      JOIN user_organization_assignments uoa ON uoa.organization_id = so.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE so.id = supply_deliveries.order_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  );

CREATE POLICY "Customer admins can update deliveries for their org orders"
  ON supply_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM supply_orders so
      JOIN user_organization_assignments uoa ON uoa.organization_id = so.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE so.id = supply_deliveries.order_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM supply_orders so
      JOIN user_organization_assignments uoa ON uoa.organization_id = so.organization_id
      JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE so.id = supply_deliveries.order_id
        AND uoa.user_id = auth.uid()
        AND ur.role = 'Customer Admin'
    )
  );
