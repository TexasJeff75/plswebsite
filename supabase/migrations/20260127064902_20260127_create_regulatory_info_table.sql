/*
  # Create Regulatory Info Table

  1. New Table: `regulatory_info`
    - Stores CLIA certificate information
    - Stores proficiency testing enrollment
    - Stores state license information
    - Links to facilities table via facility_id
*/

CREATE TABLE IF NOT EXISTS regulatory_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- CLIA Certificate
  clia_application_submitted boolean DEFAULT false,
  clia_application_date date,
  clia_number text,
  clia_certificate_type text, -- 'waiver', 'compliance', or null
  clia_certificate_received boolean DEFAULT false,
  clia_certificate_date date,
  clia_certificate_expiration date,
  
  -- Proficiency Testing
  pt_program_enrolled boolean DEFAULT false,
  pt_provider text, -- 'CAP', 'other', or null
  pt_enrollment_date date,
  
  -- State License
  state_license_required boolean DEFAULT false,
  state_license_number text,
  state_license_date date,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE regulatory_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read facility regulatory info"
  ON regulatory_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = regulatory_info.facility_id
    )
  );

CREATE POLICY "Editors can update facility regulatory info"
  ON regulatory_info FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

CREATE POLICY "Editors can insert facility regulatory info"
  ON regulatory_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );