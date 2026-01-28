/*
  # Create Reference Data Management System

  1. New Tables
    - `reference_data`
      - Stores all configurable dropdown values used throughout the application
      - Supports categories like configuration_type, facility_type, equipment_status, etc.
      - Includes display_name that can be changed, code that remains constant
      - Supports soft delete via is_active flag
      - System items (is_system=true) cannot be deleted
      - Optional color and icon fields for UI display
      - Flexible metadata JSONB field for additional properties

    - `reference_data_audit`
      - Tracks all changes to reference data for compliance and debugging
      - Records who made changes, what was changed, old/new values
      - Optional reason field for documenting why changes were made

  2. Security
    - Enable RLS on both tables
    - All authenticated users can read reference data
    - Only Proximity Admin can modify reference data

  3. Indexes
    - Optimized lookups by category
    - Fast filtering by active status
*/

-- Reference Data Table
CREATE TABLE IF NOT EXISTS reference_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  code text NOT NULL,
  display_name text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  color text,
  icon text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(category, code)
);

-- Reference Data Audit Table
CREATE TABLE IF NOT EXISTS reference_data_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_data_id uuid REFERENCES reference_data(id) ON DELETE SET NULL,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  reason text
);

-- Enable RLS
ALTER TABLE reference_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_data_audit ENABLE ROW LEVEL SECURITY;

-- Reference Data Policies
CREATE POLICY "Reference data readable by authenticated"
  ON reference_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reference data insertable by admin"
  ON reference_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Reference data updatable by admin"
  ON reference_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Reference data deletable by admin"
  ON reference_data FOR DELETE
  TO authenticated
  USING (
    is_system = false AND
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

-- Audit Policies
CREATE POLICY "Audit readable by admin"
  ON reference_data_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Audit insertable by admin"
  ON reference_data_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Proximity Admin'
    )
  );

-- Indexes
CREATE INDEX idx_reference_data_category ON reference_data(category);
CREATE INDEX idx_reference_data_active ON reference_data(category, is_active);
CREATE INDEX idx_reference_data_code ON reference_data(category, code);
CREATE INDEX idx_reference_data_audit_ref_id ON reference_data_audit(reference_data_id);
CREATE INDEX idx_reference_data_audit_changed_at ON reference_data_audit(changed_at DESC);
