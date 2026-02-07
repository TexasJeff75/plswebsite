/*
  # Fix RLS policy role name case mismatch

  The RLS policies on lab and Stratus tables were checking for snake_case
  role values (e.g. 'proximity_admin') but the actual values stored in
  user_roles are title case (e.g. 'Proximity Admin'). This caused all
  inserts/updates/deletes to be rejected for every user.

  1. Affected Tables
    - lab_orders
    - lab_order_confirmations
    - lab_results
    - stratus_orders
    - stratus_results
    - stratus_confirmations
    - stratus_facility_mappings
    - stratus_organizations
    - stratus_test_methods

  2. Changes
    - Drop and recreate admin policies using correct role names:
      'Proximity Admin', 'Proximity Staff'
    - Drop and recreate customer policies using correct role names:
      'Customer Admin', 'Customer User'

  3. Security
    - No permission changes; policies are functionally identical
    - Only the role string literals are corrected
*/

-- lab_order_confirmations
DROP POLICY IF EXISTS "Admins can manage all lab confirmations" ON lab_order_confirmations;
CREATE POLICY "Admins can manage all lab confirmations"
  ON lab_order_confirmations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- lab_orders
DROP POLICY IF EXISTS "Admins can manage all lab orders" ON lab_orders;
CREATE POLICY "Admins can manage all lab orders"
  ON lab_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

DROP POLICY IF EXISTS "Customer admins can manage their organization lab orders" ON lab_orders;
CREATE POLICY "Customer admins can manage their organization lab orders"
  ON lab_orders FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
        AND uoa.role = ANY(ARRAY['Customer Admin', 'Customer User'])
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
        AND uoa.role = ANY(ARRAY['Customer Admin', 'Customer User'])
    )
  );

-- lab_results
DROP POLICY IF EXISTS "Admins can manage all lab results" ON lab_results;
CREATE POLICY "Admins can manage all lab results"
  ON lab_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- stratus_confirmations
DROP POLICY IF EXISTS "Admins can manage all StratusDX confirmations" ON stratus_confirmations;
CREATE POLICY "Admins can manage all StratusDX confirmations"
  ON stratus_confirmations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- stratus_facility_mappings
DROP POLICY IF EXISTS "Admins can manage all StratusDX mappings" ON stratus_facility_mappings;
CREATE POLICY "Admins can manage all StratusDX mappings"
  ON stratus_facility_mappings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

DROP POLICY IF EXISTS "Customer admins can manage their organization StratusDX mapping" ON stratus_facility_mappings;
CREATE POLICY "Customer admins can manage their organization StratusDX mapping"
  ON stratus_facility_mappings FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
        AND uoa.role = 'Customer Admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT uoa.organization_id
      FROM user_organization_assignments uoa
      JOIN user_roles ur ON ur.user_id = uoa.user_id
      WHERE uoa.user_id = auth.uid()
        AND uoa.role = 'Customer Admin'
    )
  );

-- stratus_orders
DROP POLICY IF EXISTS "Admins can manage all StratusDX orders" ON stratus_orders;
CREATE POLICY "Admins can manage all StratusDX orders"
  ON stratus_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- stratus_organizations
DROP POLICY IF EXISTS "Admins can manage StratusDX organizations" ON stratus_organizations;
CREATE POLICY "Admins can manage StratusDX organizations"
  ON stratus_organizations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- stratus_results
DROP POLICY IF EXISTS "Admins can manage all StratusDX results" ON stratus_results;
CREATE POLICY "Admins can manage all StratusDX results"
  ON stratus_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );

-- stratus_test_methods
DROP POLICY IF EXISTS "Admins can manage StratusDX test methods" ON stratus_test_methods;
CREATE POLICY "Admins can manage StratusDX test methods"
  ON stratus_test_methods FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY(ARRAY['Proximity Admin', 'Proximity Staff'])
    )
  );
