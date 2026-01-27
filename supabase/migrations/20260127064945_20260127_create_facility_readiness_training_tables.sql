/*
  # Create Facility Readiness and Training Info Tables

  1. New Table: `facility_readiness_info`
    - Stores infrastructure and site assessment data
  2. New Table: `training_info`
    - Stores training schedule and completion tracking
*/

CREATE TABLE IF NOT EXISTS facility_readiness_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- Space & Infrastructure
  dedicated_space_identified boolean DEFAULT false,
  electrical_outlets_available boolean DEFAULT false,
  dedicated_circuit_required boolean DEFAULT false,
  dedicated_circuit_installed boolean DEFAULT false,
  
  -- Network Infrastructure
  network_available boolean DEFAULT false,
  network_type text, -- 'wired', 'wireless'
  
  -- Supplies Storage
  refrigerator_available boolean DEFAULT false,
  supply_storage_identified boolean DEFAULT false,
  
  -- Site Assessment
  site_assessment_complete boolean DEFAULT false,
  site_assessment_date date,
  site_assessment_notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- Initial Training
  initial_training_scheduled boolean DEFAULT false,
  initial_training_date date,
  initial_training_complete boolean DEFAULT false,
  trained_by_name text,
  trained_by_role text, -- 'technical_consultant', 'proximity_staff'
  
  -- Competency Assessment
  competency_assessment_complete boolean DEFAULT false,
  competency_assessment_date date,
  
  -- Materials Provided
  procedure_manual_provided boolean DEFAULT false,
  emergency_contacts_provided boolean DEFAULT false,
  qc_protocols_provided boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE facility_readiness_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_info ENABLE ROW LEVEL SECURITY;

-- Policies for facility_readiness_info
CREATE POLICY "Users can read facility readiness info"
  ON facility_readiness_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = facility_readiness_info.facility_id
    )
  );

CREATE POLICY "Editors can update facility readiness info"
  ON facility_readiness_info FOR UPDATE
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

CREATE POLICY "Editors can insert facility readiness info"
  ON facility_readiness_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

-- Policies for training_info
CREATE POLICY "Users can read facility training info"
  ON training_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = training_info.facility_id
    )
  );

CREATE POLICY "Editors can update training info"
  ON training_info FOR UPDATE
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

CREATE POLICY "Editors can insert training info"
  ON training_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );