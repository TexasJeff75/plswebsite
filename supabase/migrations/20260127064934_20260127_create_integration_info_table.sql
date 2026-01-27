/*
  # Create Integration Info Table

  1. New Table: `integration_info`
    - Stores LIS setup and configuration
    - Stores interface status for each instrument
    - Stores network configuration
    - Stores EHR integration details
*/

CREATE TABLE IF NOT EXISTS integration_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- LIS Setup
  lis_provider text, -- 'StratusDX'
  lis_package text, -- 'waived', 'moderate'
  lis_contract_signed boolean DEFAULT false,
  lis_setup_fee numeric,
  
  -- Auto Label Print
  auto_label_print_configured boolean DEFAULT false,
  
  -- Network
  network_connectivity_verified boolean DEFAULT false,
  network_verification_date date,
  network_type text, -- 'wired', 'wireless'
  hipaa_compliant_network boolean DEFAULT false,
  
  -- EHR Integration
  ehr_integration_required boolean DEFAULT false,
  ehr_vendor text,
  ehr_integration_complete boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interface_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_info_id uuid NOT NULL REFERENCES integration_info(id) ON DELETE CASCADE,
  
  instrument_type text NOT NULL, -- 'genexpert', 'clarity', 'epoc', 'abacus'
  interface_type text, -- 'unidirectional', 'bidirectional'
  configured boolean DEFAULT false,
  configuration_date date,
  tested_successfully boolean DEFAULT false,
  test_date date,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integration_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE interface_status ENABLE ROW LEVEL SECURITY;

-- Policies for integration_info
CREATE POLICY "Users can read facility integration info"
  ON integration_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = integration_info.facility_id
    )
  );

CREATE POLICY "Editors can update integration info"
  ON integration_info FOR UPDATE
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

CREATE POLICY "Editors can insert integration info"
  ON integration_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

-- Policies for interface_status
CREATE POLICY "Users can read interface status"
  ON interface_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_info
      JOIN facilities ON facilities.id = integration_info.facility_id
      WHERE integration_info.id = interface_status.integration_info_id
    )
  );

CREATE POLICY "Editors can update interface status"
  ON interface_status FOR UPDATE
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

CREATE POLICY "Editors can insert interface status"
  ON interface_status FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );