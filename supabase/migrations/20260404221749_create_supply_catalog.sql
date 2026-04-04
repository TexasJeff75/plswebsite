/*
  # Create Supply Catalog Table

  ## Summary
  Creates a catalog of supply items that customers can order.
  Proximity Staff manage the catalog. All authenticated users can view active items.

  ## New Tables
  - `supply_catalog`
    - `id` (uuid, primary key)
    - `name` (text, not null)
    - `description` (text)
    - `unit` (text, e.g. "box", "case", "each")
    - `category` (text)
    - `is_active` (boolean, default true)
    - `created_by` (uuid, FK to auth.users)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Proximity Staff can fully manage the catalog
  - All authenticated users can read active catalog items
*/

CREATE TABLE IF NOT EXISTS supply_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  unit text DEFAULT 'each',
  category text DEFAULT 'General',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supply_catalog_category ON supply_catalog(category);
CREATE INDEX IF NOT EXISTS idx_supply_catalog_is_active ON supply_catalog(is_active);

ALTER TABLE supply_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active catalog items"
  ON supply_catalog
  FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
  ));

CREATE POLICY "Proximity staff can insert catalog items"
  ON supply_catalog
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Proximity staff can update catalog items"
  ON supply_catalog
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

CREATE POLICY "Proximity staff can delete catalog items"
  ON supply_catalog
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );
