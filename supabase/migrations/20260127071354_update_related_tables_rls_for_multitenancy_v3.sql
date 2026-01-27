/*
  # Update Related Tables RLS for Multi-Tenancy

  ## Summary
  Updates RLS policies for all facility-related tables to support multi-tenancy
  where customers can only view their organization's data and staff can access all.

  ## Tables Updated
    - regulatory_info
    - personnel_info
    - trained_personnel
    - integration_info
    - interface_status
    - facility_readiness_info
    - training_info

  ## Security Changes
    - All tables now check user_type and organization_id
    - Customers can only view data for facilities in their organization
    - Staff can view and edit all data
    - Admins have full access
*/

-- Regulatory Info
DROP POLICY IF EXISTS "Authenticated users can read regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Editors can modify regulatory_info" ON regulatory_info;

CREATE POLICY "Users can read regulatory_info for accessible facilities"
  ON regulatory_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = regulatory_info.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify regulatory_info"
  ON regulatory_info FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Personnel Info
DROP POLICY IF EXISTS "Authenticated users can read personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Editors can modify personnel_info" ON personnel_info;

CREATE POLICY "Users can read personnel_info for accessible facilities"
  ON personnel_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = personnel_info.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify personnel_info"
  ON personnel_info FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Trained Personnel
DROP POLICY IF EXISTS "Authenticated users can read trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Editors can modify trained_personnel" ON trained_personnel;

CREATE POLICY "Users can read trained_personnel for accessible facilities"
  ON trained_personnel FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = trained_personnel.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify trained_personnel"
  ON trained_personnel FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Integration Info
DROP POLICY IF EXISTS "Authenticated users can read integration_info" ON integration_info;
DROP POLICY IF EXISTS "Editors can modify integration_info" ON integration_info;

CREATE POLICY "Users can read integration_info for accessible facilities"
  ON integration_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = integration_info.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify integration_info"
  ON integration_info FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Interface Status
DROP POLICY IF EXISTS "Authenticated users can read interface_status" ON interface_status;
DROP POLICY IF EXISTS "Editors can modify interface_status" ON interface_status;

CREATE POLICY "Users can read interface_status for accessible integrations"
  ON interface_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_info ii
      INNER JOIN facilities f ON f.id = ii.facility_id
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE ii.id = interface_status.integration_info_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify interface_status"
  ON interface_status FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Facility Readiness Info
DROP POLICY IF EXISTS "Authenticated users can read facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Editors can modify facility_readiness_info" ON facility_readiness_info;

CREATE POLICY "Users can read facility_readiness_info for accessible facilities"
  ON facility_readiness_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = facility_readiness_info.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify facility_readiness_info"
  ON facility_readiness_info FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

-- Training Info
DROP POLICY IF EXISTS "Authenticated users can read training_info" ON training_info;
DROP POLICY IF EXISTS "Editors can modify training_info" ON training_info;

CREATE POLICY "Users can read training_info for accessible facilities"
  ON training_info FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = training_info.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify training_info"
  ON training_info FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );
