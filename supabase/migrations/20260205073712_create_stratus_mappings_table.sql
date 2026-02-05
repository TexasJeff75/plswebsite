/*
  # Create StratusDX Mapping System

  1. New Tables
    - `stratus_facility_mappings`
      - Maps StratusDX facility identifiers to Deployment Tracker organizations and facilities
      - Supports multiple mapping types (facility name, ID, account number, etc.)
      - Tracks mapping status and last sync information
  
  2. Security
    - Enable RLS on mappings table
    - Admin and internal users can manage all mappings
    - Customer users can view their organization's mappings
  
  3. Indexes
    - Add indexes for foreign keys and frequently queried fields
    - Index on StratusDX identifiers for fast lookups during sync

  4. Notes
    - This allows the sync functions to automatically assign incoming lab data
    - Supports flexible matching strategies (exact match, contains, pattern)
*/

-- StratusDX Facility Mappings Table
CREATE TABLE IF NOT EXISTS stratus_facility_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Deployment Tracker references
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- StratusDX identifiers
  stratus_facility_identifier text NOT NULL,
  stratus_organization_identifier text,
  
  -- Mapping configuration
  mapping_type text DEFAULT 'exact' CHECK (mapping_type IN ('exact', 'contains', 'pattern', 'custom')),
  is_active boolean DEFAULT true,
  
  -- Notes and metadata
  notes text,
  last_matched_at timestamptz,
  match_count integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure unique mappings per StratusDX identifier
  UNIQUE(stratus_facility_identifier, organization_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stratus_mappings_organization ON stratus_facility_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_stratus_mappings_facility ON stratus_facility_mappings(facility_id);
CREATE INDEX IF NOT EXISTS idx_stratus_mappings_stratus_facility ON stratus_facility_mappings(stratus_facility_identifier);
CREATE INDEX IF NOT EXISTS idx_stratus_mappings_stratus_org ON stratus_facility_mappings(stratus_organization_identifier);
CREATE INDEX IF NOT EXISTS idx_stratus_mappings_active ON stratus_facility_mappings(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE stratus_facility_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stratus_facility_mappings
CREATE POLICY "Admins can manage all StratusDX mappings"
  ON stratus_facility_mappings FOR ALL
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

CREATE POLICY "Users can view their organization StratusDX mappings"
  ON stratus_facility_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customer admins can manage their organization StratusDX mappings"
  ON stratus_facility_mappings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
      AND uoa.role = 'customer_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
      AND uoa.role = 'customer_admin'
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stratus_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

-- Trigger for updated_at
CREATE TRIGGER update_stratus_mappings_updated_at
  BEFORE UPDATE ON stratus_facility_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_stratus_mappings_updated_at();

-- Function to find matching facility mapping
CREATE OR REPLACE FUNCTION find_stratus_facility_mapping(
  p_facility_identifier text,
  p_organization_identifier text DEFAULT NULL
)
RETURNS TABLE (
  organization_id uuid,
  facility_id uuid,
  mapping_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sfm.organization_id,
    sfm.facility_id,
    sfm.id as mapping_id
  FROM stratus_facility_mappings sfm
  WHERE sfm.is_active = true
    AND (
      (sfm.mapping_type = 'exact' AND sfm.stratus_facility_identifier = p_facility_identifier)
      OR (sfm.mapping_type = 'contains' AND p_facility_identifier ILIKE '%' || sfm.stratus_facility_identifier || '%')
      OR (sfm.mapping_type = 'pattern' AND p_facility_identifier ~ sfm.stratus_facility_identifier)
    )
    AND (
      p_organization_identifier IS NULL 
      OR sfm.stratus_organization_identifier IS NULL
      OR sfm.stratus_organization_identifier = p_organization_identifier
    )
  ORDER BY 
    CASE sfm.mapping_type
      WHEN 'exact' THEN 1
      WHEN 'contains' THEN 2
      WHEN 'pattern' THEN 3
      ELSE 4
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;
