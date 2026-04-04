/*
  # Create Supply Order Activity Log and Auto-Update Triggers

  ## Summary
  Creates an activity log for supply order status changes and sets up
  auto-update triggers for the updated_at column.

  ## New Tables
  - `supply_order_activity`
    - `id` (uuid, primary key)
    - `order_id` (uuid, FK to supply_orders)
    - `actor_user_id` (uuid, FK to auth.users)
    - `action` (text)
    - `from_status` (text)
    - `to_status` (text)
    - `notes` (text)
    - `created_at` (timestamptz)

  ## New Functions & Triggers
  - `update_supply_orders_updated_at()` - updates updated_at on row change
  - `update_supply_deliveries_updated_at()` - updates updated_at on row change
*/

CREATE TABLE IF NOT EXISTS supply_order_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  from_status text,
  to_status text,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_order_activity_order_id ON supply_order_activity(order_id);

ALTER TABLE supply_order_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity for accessible orders"
  ON supply_order_activity
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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
          AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM supply_deliveries sd
      WHERE sd.order_id = supply_order_activity.order_id
      AND sd.assigned_courier_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can log activity"
  ON supply_order_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_supply_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supply_orders_updated_at
  BEFORE UPDATE ON supply_orders
  FOR EACH ROW EXECUTE FUNCTION update_supply_orders_updated_at();

CREATE OR REPLACE FUNCTION update_supply_deliveries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_supply_deliveries_updated_at
  BEFORE UPDATE ON supply_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_supply_deliveries_updated_at();
