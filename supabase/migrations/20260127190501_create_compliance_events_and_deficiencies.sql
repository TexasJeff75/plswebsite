/*
  # Create Compliance Events and Deficiencies Tracking System

  1. New Tables
    - `compliance_events`
      - Tracks all compliance-related events for sites
      - Types: PT due/completed/failed, CLIA expiring/renewed, surveys, competency
      - Stores event details and status
    
    - `deficiencies`
      - Tracks regulatory deficiencies and corrective actions
      - Includes type, severity, tag numbers, CAP tracking
      - Assignment and due date tracking

  2. Regulatory Info Table Enhancement
    - Add additional fields for accreditation and state licensing
    - Track survey outcomes and dates

  3. Security
    - Enable RLS on all tables
    - Compliance specialists have full access
    - Customers can view their organization's compliance data
    - Staff can manage compliance for assigned sites

  4. Indexes
    - Optimized for compliance queries by site, date, status
    - Deficiency lookups by severity and due date
*/

-- Compliance Events Table
CREATE TABLE IF NOT EXISTS compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  
  event_type text NOT NULL, -- 'pt_due', 'pt_completed', 'pt_failed', 'clia_expiring', 'clia_renewed', 'survey_scheduled', 'survey_completed', 'deficiency_opened', 'deficiency_closed', 'competency_due', 'competency_completed'
  event_date date NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  details jsonb DEFAULT '{}'::jsonb,
  notes text,
  
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Deficiencies Table
CREATE TABLE IF NOT EXISTS deficiencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  
  deficiency_type text NOT NULL, -- 'standard', 'condition', 'immediate_jeopardy'
  severity text NOT NULL, -- 'low', 'medium', 'high', 'critical'
  tag_number text,
  description text NOT NULL,
  corrective_action_plan text,
  
  opened_date date NOT NULL,
  due_date date,
  closed_date date,
  status text DEFAULT 'open', -- 'open', 'in_progress', 'pending_verification', 'closed'
  
  assigned_to uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enhance Regulatory Info Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'certificate_holder_type'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN certificate_holder_type text DEFAULT 'client';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'accreditation_body'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN accreditation_body text; -- 'CAP', 'COLA', 'TJC', 'AABB', 'None'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'accreditation_number'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN accreditation_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'accreditation_expiration'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN accreditation_expiration date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'last_survey_date'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN last_survey_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'next_survey_due'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN next_survey_due date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'survey_outcome'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN survey_outcome text; -- 'passed', 'passed_with_deficiencies', 'failed'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'state_license_number'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN state_license_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regulatory_info' AND column_name = 'state_license_expiration'
  ) THEN
    ALTER TABLE regulatory_info ADD COLUMN state_license_expiration date;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE deficiencies ENABLE ROW LEVEL SECURITY;

-- Compliance Events Policies

CREATE POLICY "Users can read compliance events for their sites"
  ON compliance_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_roles ur ON ur.organization_id = f.organization_id
      WHERE f.id = compliance_events.site_id
      AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Technical Consultant')
    )
  );

CREATE POLICY "Staff can create compliance events"
  ON compliance_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Technical Consultant', 'Customer Admin')
    )
  );

CREATE POLICY "Staff can update compliance events"
  ON compliance_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Technical Consultant', 'Customer Admin')
    )
  );

CREATE POLICY "Admins can delete compliance events"
  ON compliance_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Compliance Specialist')
    )
  );

-- Deficiencies Policies

CREATE POLICY "Users can read deficiencies for their sites"
  ON deficiencies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_roles ur ON ur.organization_id = f.organization_id
      WHERE f.id = deficiencies.site_id
      AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Technical Consultant')
    )
  );

CREATE POLICY "Staff can create deficiencies"
  ON deficiencies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Technical Consultant')
    )
  );

CREATE POLICY "Staff can update deficiencies"
  ON deficiencies FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist')
    )
  );

CREATE POLICY "Admins can delete deficiencies"
  ON deficiencies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Compliance Specialist')
    )
  );

-- Indexes
CREATE INDEX idx_compliance_events_site_id ON compliance_events(site_id);
CREATE INDEX idx_compliance_events_event_type ON compliance_events(event_type);
CREATE INDEX idx_compliance_events_event_date ON compliance_events(event_date DESC);
CREATE INDEX idx_compliance_events_status ON compliance_events(status);

CREATE INDEX idx_deficiencies_site_id ON deficiencies(site_id);
CREATE INDEX idx_deficiencies_severity ON deficiencies(severity);
CREATE INDEX idx_deficiencies_status ON deficiencies(status);
CREATE INDEX idx_deficiencies_assigned_to ON deficiencies(assigned_to);
CREATE INDEX idx_deficiencies_due_date ON deficiencies(due_date);
CREATE INDEX idx_deficiencies_opened_date ON deficiencies(opened_date DESC);

-- Add indexes for regulatory info enhancements
CREATE INDEX IF NOT EXISTS idx_regulatory_info_accreditation_expiration ON regulatory_info(accreditation_expiration);
CREATE INDEX IF NOT EXISTS idx_regulatory_info_state_license_expiration ON regulatory_info(state_license_expiration);
CREATE INDEX IF NOT EXISTS idx_regulatory_info_next_survey_due ON regulatory_info(next_survey_due);

-- Trigger for updating updated_at
CREATE TRIGGER trigger_update_compliance_events_updated_at
  BEFORE UPDATE ON compliance_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_deficiencies_updated_at
  BEFORE UPDATE ON deficiencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();