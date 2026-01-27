/*
  # Create Personnel Tables

  1. New Table: `personnel_info`
    - Stores facility contacts and laboratory director info
  2. New Table: `trained_personnel`
    - Stores trained staff and their certifications
*/

CREATE TABLE IF NOT EXISTS personnel_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL UNIQUE REFERENCES facilities(id) ON DELETE CASCADE,
  
  -- Facility Administrator
  facility_admin_name text,
  facility_admin_email text,
  facility_admin_phone text,
  
  -- Lab Director (required for Moderate Complexity)
  lab_director_required boolean DEFAULT false,
  lab_director_name text,
  lab_director_credentials text, -- MD, DO, etc.
  lab_director_npi_number text,
  lab_director_agreement_signed boolean DEFAULT false,
  lab_director_agreement_date date,
  lab_director_other_labs_supervised numeric DEFAULT 0,
  
  -- Technical Consultant
  technical_consultant_assigned boolean DEFAULT false,
  technical_consultant_name text,
  technical_consultant_region text, -- 'east', 'west'
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trained_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  title text,
  email text,
  initial_training_date date,
  initial_training_complete boolean DEFAULT false,
  competency_assessment_date date,
  competency_assessment_complete boolean DEFAULT false,
  annual_competency_due date,
  instruments_certified text[] DEFAULT '{}'::text[], -- Array of 'genexpert', 'clarity', 'epoc', 'abacus'
  active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE personnel_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE trained_personnel ENABLE ROW LEVEL SECURITY;

-- Policies for personnel_info
CREATE POLICY "Users can read facility personnel info"
  ON personnel_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = personnel_info.facility_id
    )
  );

CREATE POLICY "Editors can update personnel info"
  ON personnel_info FOR UPDATE
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

CREATE POLICY "Editors can insert personnel info"
  ON personnel_info FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

-- Policies for trained_personnel
CREATE POLICY "Users can read facility trained personnel"
  ON trained_personnel FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = trained_personnel.facility_id
    )
  );

CREATE POLICY "Editors can update trained personnel"
  ON trained_personnel FOR UPDATE
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

CREATE POLICY "Editors can insert trained personnel"
  ON trained_personnel FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

CREATE POLICY "Editors can delete trained personnel"
  ON trained_personnel FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );