/*
  # Create Supply Orders and Order Items Tables

  ## Summary
  Core tables for the supply ordering workflow. Customers create orders,
  Customer Admins and Proximity Staff approve and manage them.

  ## New Tables

  ### supply_orders
  - `id` (uuid, primary key)
  - `order_number` (text, unique, auto-generated)
  - `facility_id` (uuid, FK to facilities)
  - `organization_id` (uuid, FK to organizations)
  - `requested_by` (uuid, FK to auth.users)
  - `approved_by` (uuid, FK to auth.users, nullable)
  - `status` (text with CHECK constraint)
  - `notes` (text)
  - `cancel_reason` (text)
  - `created_at`, `updated_at` (timestamptz)

  ### supply_order_items
  - `id` (uuid, primary key)
  - `order_id` (uuid, FK to supply_orders)
  - `catalog_item_id` (uuid, FK to supply_catalog, nullable)
  - `free_form_description` (text, for unlisted items)
  - `quantity_requested` (integer)
  - `quantity_fulfilled` (integer, nullable)
  - `notes` (text)
  - `created_at` (timestamptz)

  ## Security
  - Customer Viewer: INSERT only (create), SELECT on own org
  - Customer Admin: INSERT and UPDATE, SELECT on own org
  - Proximity Staff: unrestricted
  - Courier: no access to orders
*/

CREATE TABLE IF NOT EXISTS supply_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT 'SO-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'processing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  notes text DEFAULT '',
  cancel_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_orders_facility_id ON supply_orders(facility_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_organization_id ON supply_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_status ON supply_orders(status);
CREATE INDEX IF NOT EXISTS idx_supply_orders_requested_by ON supply_orders(requested_by);

ALTER TABLE supply_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer users can create orders for their org"
  ON supply_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

CREATE POLICY "Customer users can view their org orders"
  ON supply_orders
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Customer admins and proximity staff can update orders"
  ON supply_orders
  FOR UPDATE
  TO authenticated
  USING (
    (
      organization_id IN (
        SELECT organization_id FROM user_organization_assignments
        WHERE user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'Customer Admin'
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  )
  WITH CHECK (
    (
      organization_id IN (
        SELECT organization_id FROM user_organization_assignments
        WHERE user_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'Customer Admin'
      )
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE TABLE IF NOT EXISTS supply_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES supply_orders(id) ON DELETE CASCADE,
  catalog_item_id uuid REFERENCES supply_catalog(id),
  free_form_description text DEFAULT '',
  quantity_requested integer NOT NULL CHECK (quantity_requested > 0),
  quantity_fulfilled integer,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_order_items_order_id ON supply_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_catalog_item_id ON supply_order_items(catalog_item_id);

ALTER TABLE supply_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order items for accessible orders"
  ON supply_order_items
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
  );

CREATE POLICY "Users can insert order items for their orders"
  ON supply_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM supply_orders so
      WHERE so.id = order_id
      AND so.requested_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Proximity staff and customer admins can update order items"
  ON supply_order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin', 'Customer Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin', 'Customer Admin')
    )
  );

CREATE POLICY "Proximity staff can delete order items"
  ON supply_order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );
