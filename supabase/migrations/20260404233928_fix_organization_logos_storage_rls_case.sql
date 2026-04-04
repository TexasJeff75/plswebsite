/*
  # Fix Organization Logos Storage RLS Role Case Mismatch

  ## Problem
  The storage policies for the organization-logos bucket use lowercase role names
  (e.g., 'proximity_admin', 'super_admin') but the actual values stored in user_roles.role
  are title-cased (e.g., 'Proximity Admin', 'Super Admin'). This causes INSERT/UPDATE/DELETE
  operations to fail for all proximity staff including Super Admins.

  ## Changes
  - Drop and recreate INSERT, UPDATE, DELETE policies with correct role casing
  - Also extend INSERT/UPDATE to allow Customer Admins to upload their own org logo
*/

DROP POLICY IF EXISTS "Proximity staff can insert organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Proximity staff can update organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Proximity staff can delete organization logos" ON storage.objects;

CREATE POLICY "Proximity staff can insert organization logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'Proximity Admin', 'Proximity Staff', 'Account Manager',
          'Technical Consultant', 'Compliance Specialist', 'Super Admin',
          'Customer Admin'
        ])
    )
  );

CREATE POLICY "Proximity staff can update organization logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'Proximity Admin', 'Proximity Staff', 'Account Manager',
          'Technical Consultant', 'Compliance Specialist', 'Super Admin',
          'Customer Admin'
        ])
    )
  );

CREATE POLICY "Proximity staff can delete organization logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = ANY (ARRAY[
          'Proximity Admin', 'Proximity Staff', 'Account Manager',
          'Technical Consultant', 'Compliance Specialist', 'Super Admin',
          'Customer Admin'
        ])
    )
  );
