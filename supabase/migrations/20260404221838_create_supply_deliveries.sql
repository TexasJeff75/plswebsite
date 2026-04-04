/*
  # Create Supply Deliveries Table

  ## Summary
  Tracks the physical delivery of supply orders by couriers.
  Each delivery is linked to one order. A QR token is generated at dispatch
  and is used by the courier to prove both pick-up and delivery.

  ## New Tables
  - `supply_deliveries`
    - `id` (uuid, primary key)
    - `order_id` (uuid, unique FK to supply_orders)
    - `assigned_courier_user_id` (uuid, FK to auth.users)
    - `tracking_number` (text)
    - `estimated_delivery_date` (date)
    - `qr_token` (uuid, unique) - generated at dispatch, used for both pick-up and delivery verification
    - `qr_used` (boolean, default false) - set true after delivery confirmation
    - Pick-up fields: `picked_up_at`, `picked_up_signature`, `courier_typed_name_at_pickup`
    - Delivery fields: `delivered_at`, `recipient_typed_name`, `recipient_signature`,
      `courier_typed_name`, `delivery_latitude`, `delivery_longitude`,
      `delivery_timezone`, `delivery_local_timestamp`
    - `created_at`, `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Proximity Staff: full access
  - Courier: SELECT and UPDATE only on their own assigned deliveries
  - Customer Admin/Viewer: SELECT on deliveries linked to their org's orders
*/

CREATE TABLE IF NOT EXISTS supply_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
  assigned_courier_user_id uuid NOT NULL REFERENCES auth.users(id),
  tracking_number text DEFAULT '',
  estimated_delivery_date date,
  qr_token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  qr_used boolean DEFAULT false,

  picked_up_at timestamptz,
  picked_up_signature text DEFAULT '',
  courier_typed_name_at_pickup text DEFAULT '',

  delivered_at timestamptz,
  recipient_typed_name text DEFAULT '',
  recipient_signature text DEFAULT '',
  courier_typed_name text DEFAULT '',
  delivery_latitude numeric(10, 7),
  delivery_longitude numeric(10, 7),
  delivery_timezone text DEFAULT '',
  delivery_local_timestamp text DEFAULT '',

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_deliveries_order_id ON supply_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_supply_deliveries_qr_token ON supply_deliveries(qr_token);
CREATE INDEX IF NOT EXISTS idx_supply_deliveries_courier_user_id ON supply_deliveries(assigned_courier_user_id);

ALTER TABLE supply_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity staff can manage deliveries"
  ON supply_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Proximity staff can update all deliveries"
  ON supply_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Couriers can update their own deliveries"
  ON supply_deliveries
  FOR UPDATE
  TO authenticated
  USING (
    assigned_courier_user_id = auth.uid()
  )
  WITH CHECK (
    assigned_courier_user_id = auth.uid()
  );

CREATE POLICY "Proximity staff can view all deliveries"
  ON supply_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Couriers can view their assigned deliveries"
  ON supply_deliveries
  FOR SELECT
  TO authenticated
  USING (
    assigned_courier_user_id = auth.uid()
  );

CREATE POLICY "Customer users can view deliveries for their org orders"
  ON supply_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM supply_orders so
      JOIN user_organization_assignments uoa ON uoa.organization_id = so.organization_id
      WHERE so.id = order_id
      AND uoa.user_id = auth.uid()
    )
  );
