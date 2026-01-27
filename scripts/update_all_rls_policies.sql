-- This script updates all RLS policies to use the new consolidated roles
-- and removes dependency on user_type field

-- Organizations policies
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Proximity Admin')
  );

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Proximity Admin')
  );

CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'Proximity Admin')
  );

-- Facilities policies
DROP POLICY IF EXISTS "Staff and admins can read all facilities" ON facilities;
DROP POLICY IF EXISTS "Customers can read their organization facilities" ON facilities;
DROP POLICY IF EXISTS "Staff and admins can insert facilities" ON facilities;
DROP POLICY IF EXISTS "Staff and admins can update facilities" ON facilities;
DROP POLICY IF EXISTS "Admins can delete facilities" ON facilities;

CREATE POLICY "Staff can read all facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
  );

CREATE POLICY "Customers can read their organization facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Staff can insert facilities"
  ON facilities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant'))
  );

CREATE POLICY "Staff can update facilities"
  ON facilities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Customer Admin'))
  );

CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Customer Admin'))
  );

-- Milestones policies
DROP POLICY IF EXISTS "Users can read milestones for accessible facilities" ON milestones;
DROP POLICY IF EXISTS "Staff can modify milestones" ON milestones;

CREATE POLICY "Users can read milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = milestones.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify milestones"
  ON milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Customer Admin'))
  );

-- Equipment policies
DROP POLICY IF EXISTS "Users can read equipment for accessible facilities" ON equipment;
DROP POLICY IF EXISTS "Staff can modify equipment" ON equipment;

CREATE POLICY "Users can read equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = equipment.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Customer Admin'))
  );

-- Documents policies
DROP POLICY IF EXISTS "Users can read documents for accessible facilities" ON documents;
DROP POLICY IF EXISTS "Staff can modify documents" ON documents;

CREATE POLICY "Users can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = documents.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify documents"
  ON documents FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Customer Admin'))
  );

-- Regulatory Info policies
DROP POLICY IF EXISTS "Users can read regulatory_info for accessible facilities" ON regulatory_info;
DROP POLICY IF EXISTS "Staff can modify regulatory_info" ON regulatory_info;

CREATE POLICY "Users can read regulatory_info"
  ON regulatory_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = regulatory_info.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify regulatory_info"
  ON regulatory_info FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Compliance Specialist', 'Customer Admin'))
  );

-- Personnel Info policies
DROP POLICY IF EXISTS "Users can read personnel_info for accessible facilities" ON personnel_info;
DROP POLICY IF EXISTS "Staff can modify personnel_info" ON personnel_info;

CREATE POLICY "Users can read personnel_info"
  ON personnel_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = personnel_info.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify personnel_info"
  ON personnel_info FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Trained Personnel policies
DROP POLICY IF EXISTS "Users can read trained_personnel for accessible facilities" ON trained_personnel;
DROP POLICY IF EXISTS "Staff can modify trained_personnel" ON trained_personnel;

CREATE POLICY "Users can read trained_personnel"
  ON trained_personnel FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = trained_personnel.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify trained_personnel"
  ON trained_personnel FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Integration Info policies
DROP POLICY IF EXISTS "Users can read integration_info for accessible facilities" ON integration_info;
DROP POLICY IF EXISTS "Staff can modify integration_info" ON integration_info;

CREATE POLICY "Users can read integration_info"
  ON integration_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = integration_info.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify integration_info"
  ON integration_info FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Interface Status policies
DROP POLICY IF EXISTS "Users can read interface_status for accessible integrations" ON interface_status;
DROP POLICY IF EXISTS "Staff can modify interface_status" ON interface_status;

CREATE POLICY "Users can read interface_status"
  ON interface_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_info ii
      JOIN facilities f ON f.id = ii.facility_id
      WHERE ii.id = interface_status.integration_info_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify interface_status"
  ON interface_status FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Facility Readiness Info policies
DROP POLICY IF EXISTS "Users can read facility_readiness_info for accessible facilitie" ON facility_readiness_info;
DROP POLICY IF EXISTS "Staff can modify facility_readiness_info" ON facility_readiness_info;

CREATE POLICY "Users can read facility_readiness_info"
  ON facility_readiness_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = facility_readiness_info.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify facility_readiness_info"
  ON facility_readiness_info FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Training Info policies
DROP POLICY IF EXISTS "Users can read training_info for accessible facilities" ON training_info;
DROP POLICY IF EXISTS "Staff can modify training_info" ON training_info;

CREATE POLICY "Users can read training_info"
  ON training_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      WHERE f.id = training_info.facility_id
      AND (
        f.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'))
      )
    )
  );

CREATE POLICY "Staff can modify training_info"
  ON training_info FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin'))
  );

-- Drop user_type column
ALTER TABLE user_roles DROP COLUMN IF EXISTS user_type;

-- Add role constraint
ALTER TABLE user_roles
ADD CONSTRAINT IF NOT EXISTS valid_user_role
CHECK (role IN (
  'Proximity Admin',
  'Proximity Staff',
  'Account Manager',
  'Technical Consultant',
  'Compliance Specialist',
  'Customer Admin',
  'Customer Viewer'
));
