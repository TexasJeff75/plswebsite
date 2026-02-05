/*
  # Create Lab Integration System for StratusDX

  1. New Tables
    - `lab_orders`
      - Stores pending and processed orders from StratusDX
      - Links orders to facilities and organizations
      - Tracks sync status and acknowledgment
    
    - `lab_order_confirmations`
      - Stores received confirmations (HL7 messages)
      - Links confirmations to original orders
      - Tracks accession numbers and received times
    
    - `lab_results`
      - Stores test results from StratusDX
      - Links results to orders and facilities
      - Stores raw result data and parsed information

  2. Security
    - Enable RLS on all tables
    - Admin and internal users can manage all records
    - Customer users can view their organization's records
    - Facility-specific access based on assignments

  3. Indexes
    - Add indexes for foreign keys and frequently queried fields
    - Index on GUID fields for fast lookups
    - Index on sync status for processing queries
*/

-- Lab Orders Table
CREATE TABLE IF NOT EXISTS lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  
  -- StratusDX identifiers
  stratus_guid text UNIQUE NOT NULL,
  accession_number text,
  
  -- Order details
  order_data jsonb DEFAULT '{}'::jsonb,
  patient_demographics jsonb DEFAULT '{}'::jsonb,
  test_info jsonb DEFAULT '{}'::jsonb,
  
  -- Sync tracking
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'retrieved', 'acknowledged', 'error')),
  sync_error text,
  retrieved_at timestamptz,
  acknowledged_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lab Order Confirmations Table
CREATE TABLE IF NOT EXISTS lab_order_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  
  -- StratusDX identifiers
  stratus_guid text UNIQUE NOT NULL,
  accession_number text,
  
  -- Confirmation details
  received_time text,
  hl7_message text,
  confirmation_data jsonb DEFAULT '{}'::jsonb,
  
  -- Sync tracking
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'retrieved', 'acknowledged', 'error')),
  sync_error text,
  retrieved_at timestamptz,
  acknowledged_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lab Results Table
CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  
  -- StratusDX identifiers
  stratus_guid text UNIQUE NOT NULL,
  accession_number text,
  
  -- Result details
  result_data jsonb DEFAULT '{}'::jsonb,
  hl7_result text,
  test_results jsonb DEFAULT '[]'::jsonb,
  
  -- Result metadata
  result_status text,
  result_date timestamptz,
  
  -- Sync tracking
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'retrieved', 'acknowledged', 'error')),
  sync_error text,
  retrieved_at timestamptz,
  acknowledged_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lab_orders_organization ON lab_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_facility ON lab_orders(facility_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_stratus_guid ON lab_orders(stratus_guid);
CREATE INDEX IF NOT EXISTS idx_lab_orders_accession ON lab_orders(accession_number);
CREATE INDEX IF NOT EXISTS idx_lab_orders_sync_status ON lab_orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_lab_orders_created_at ON lab_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_confirmations_organization ON lab_order_confirmations(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_confirmations_facility ON lab_order_confirmations(facility_id);
CREATE INDEX IF NOT EXISTS idx_lab_confirmations_order ON lab_order_confirmations(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_confirmations_stratus_guid ON lab_order_confirmations(stratus_guid);
CREATE INDEX IF NOT EXISTS idx_lab_confirmations_accession ON lab_order_confirmations(accession_number);
CREATE INDEX IF NOT EXISTS idx_lab_confirmations_sync_status ON lab_order_confirmations(sync_status);

CREATE INDEX IF NOT EXISTS idx_lab_results_organization ON lab_results(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_facility ON lab_results(facility_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_stratus_guid ON lab_results(stratus_guid);
CREATE INDEX IF NOT EXISTS idx_lab_results_accession ON lab_results(accession_number);
CREATE INDEX IF NOT EXISTS idx_lab_results_sync_status ON lab_results(sync_status);
CREATE INDEX IF NOT EXISTS idx_lab_results_result_date ON lab_results(result_date DESC);

-- Enable RLS
ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_order_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lab_orders
CREATE POLICY "Admins can manage all lab orders"
  ON lab_orders FOR ALL
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

CREATE POLICY "Users can view their organization lab orders"
  ON lab_orders FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customer admins can manage their organization lab orders"
  ON lab_orders FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
      AND uoa.role IN ('customer_admin', 'customer_user')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
      AND uoa.role IN ('customer_admin', 'customer_user')
    )
  );

-- RLS Policies for lab_order_confirmations
CREATE POLICY "Admins can manage all lab confirmations"
  ON lab_order_confirmations FOR ALL
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

CREATE POLICY "Users can view their organization lab confirmations"
  ON lab_order_confirmations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for lab_results
CREATE POLICY "Admins can manage all lab results"
  ON lab_results FOR ALL
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

CREATE POLICY "Users can view their organization lab results"
  ON lab_results FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organization_assignments
      WHERE user_id = auth.uid()
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lab_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

-- Triggers for updated_at
CREATE TRIGGER update_lab_orders_updated_at
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_tables_updated_at();

CREATE TRIGGER update_lab_confirmations_updated_at
  BEFORE UPDATE ON lab_order_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_tables_updated_at();

CREATE TRIGGER update_lab_results_updated_at
  BEFORE UPDATE ON lab_results
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_tables_updated_at();
