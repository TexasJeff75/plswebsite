/*
  # Create StratusDX Reference Data Tables

  1. New Tables
    - `stratus_organizations`
      - Stores the master list of StratusDX organizations
      - Organization codes (AMMO, AMGA, CSPI, etc.) and names
      - Used for validation and display of incoming lab data
    
    - `stratus_test_methods`
      - Stores the master list of StratusDX test method codes and names
      - Used for validation, filtering, and reporting
      - Examples: AMA Confirmation, AMA Screens, PCR Testing, etc.
    
  2. Security
    - Enable RLS on both tables
    - Admin and internal users can manage reference data
    - All authenticated users can view reference data (read-only for most)
  
  3. Indexes
    - Index on code fields for fast lookups
    - Index on active status for filtering
  
  4. Notes
    - These are lookup/reference tables that define what organizations and test methods exist in StratusDX
    - Used by the sync functions to validate and enrich incoming data
    - Can be extended to link organizations to test methods if needed
*/

-- StratusDX Organizations Reference Table
CREATE TABLE IF NOT EXISTS stratus_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- StratusDX identifiers
  organization_code text UNIQUE NOT NULL,
  organization_name text NOT NULL,
  
  -- Configuration
  is_active boolean DEFAULT true,
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- StratusDX Test Methods Reference Table
CREATE TABLE IF NOT EXISTS stratus_test_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Test method identifiers
  test_method_code text UNIQUE NOT NULL,
  test_method_name text NOT NULL,
  
  -- Configuration
  is_active boolean DEFAULT true,
  
  -- Metadata
  description text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stratus_orgs_code ON stratus_organizations(organization_code);
CREATE INDEX IF NOT EXISTS idx_stratus_orgs_active ON stratus_organizations(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_stratus_test_methods_code ON stratus_test_methods(test_method_code);
CREATE INDEX IF NOT EXISTS idx_stratus_test_methods_active ON stratus_test_methods(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE stratus_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stratus_test_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stratus_organizations
CREATE POLICY "Admins can manage StratusDX organizations"
  ON stratus_organizations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  );

CREATE POLICY "All authenticated users can view StratusDX organizations"
  ON stratus_organizations FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for stratus_test_methods
CREATE POLICY "Admins can manage StratusDX test methods"
  ON stratus_test_methods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('proximity_admin', 'proximity_staff')
    )
  );

CREATE POLICY "All authenticated users can view StratusDX test methods"
  ON stratus_test_methods FOR SELECT
  TO authenticated
  USING (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stratus_reference_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

-- Triggers for updated_at
CREATE TRIGGER update_stratus_organizations_updated_at
  BEFORE UPDATE ON stratus_organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_stratus_reference_updated_at();

CREATE TRIGGER update_stratus_test_methods_updated_at
  BEFORE UPDATE ON stratus_test_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_stratus_reference_updated_at();
