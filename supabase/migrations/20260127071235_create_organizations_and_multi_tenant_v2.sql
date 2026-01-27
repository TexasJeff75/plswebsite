/*
  # Create Organizations and Multi-Tenant System

  ## Summary
  Implements a multi-tenant system where customers can view their own facilities,
  staff can edit all facilities, and admins can manage users and organizations.

  ## 1. New Tables
    - `organizations`
      - `id` (uuid, primary key)
      - `name` (text) - Organization/customer name
      - `type` (text) - 'customer' or 'internal'
      - `contact_email` (text)
      - `contact_phone` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Modified Tables
    - `user_roles`
      - Add `organization_id` (uuid, references organizations, nullable)
      - Add `user_type` (text) - 'admin', 'staff', or 'customer'
      - Staff and admins have no organization_id (can see all)
      - Customers are tied to an organization
    
    - `facilities`
      - Add `organization_id` (uuid, references organizations, nullable for now)

  ## 3. Security Changes
    - Customers can only view facilities in their organization
    - Staff can view and edit all facilities
    - Admins have full access including user management

  ## 4. Notes
    - First user with email jeff.lutz@proximitylabservices.com will be set as Admin
    - Organizations table allows grouping facilities by customer
    - Internal organization created for Proximity Lab Services
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'customer',
  contact_email text,
  contact_phone text,
  address text,
  city text,
  state text,
  zip text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT organizations_type_check CHECK (type IN ('customer', 'internal'))
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create internal organization for Proximity Lab Services
INSERT INTO organizations (id, name, type, contact_email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Proximity Lab Services',
  'internal',
  'info@proximitylabservices.com'
)
ON CONFLICT DO NOTHING;

-- Add columns to user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'user_type'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN user_type text NOT NULL DEFAULT 'staff';
    ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_type_check CHECK (user_type IN ('admin', 'staff', 'customer'));
  END IF;
END $$;

-- Add organization_id to facilities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE facilities ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update the handle_new_user function to check for admin email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin user
  IF NEW.email = 'jeff.lutz@proximitylabservices.com' THEN
    INSERT INTO public.user_roles (user_id, email, display_name, role, user_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Admin',
      'admin'
    );
  ELSE
    -- Default to viewer staff
    INSERT INTO public.user_roles (user_id, email, display_name, role, user_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Viewer',
      'staff'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Authenticated users can read organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  );

-- Drop and recreate facilities policies
DROP POLICY IF EXISTS "Authenticated users can read facilities" ON facilities;
DROP POLICY IF EXISTS "Editors can insert facilities" ON facilities;
DROP POLICY IF EXISTS "Editors can update facilities" ON facilities;
DROP POLICY IF EXISTS "Admins can delete facilities" ON facilities;

CREATE POLICY "Staff and admins can read all facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff')
    )
  );

CREATE POLICY "Customers can read their organization facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
        AND user_type = 'customer'
        AND organization_id = facilities.organization_id
    )
  );

CREATE POLICY "Staff and admins can insert facilities"
  ON facilities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type IN ('admin', 'staff') AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Staff and admins can update facilities"
  ON facilities FOR UPDATE
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

CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND user_type = 'admin'
    )
  );

-- Update milestones policies
DROP POLICY IF EXISTS "Authenticated users can read milestones" ON milestones;
DROP POLICY IF EXISTS "Editors can insert milestones" ON milestones;
DROP POLICY IF EXISTS "Editors can update milestones" ON milestones;
DROP POLICY IF EXISTS "Admins can delete milestones" ON milestones;

CREATE POLICY "Users can read milestones for accessible facilities"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = milestones.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify milestones"
  ON milestones FOR ALL
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

-- Update equipment policies
DROP POLICY IF EXISTS "Authenticated users can read equipment" ON equipment;
DROP POLICY IF EXISTS "Editors can insert equipment" ON equipment;
DROP POLICY IF EXISTS "Editors can update equipment" ON equipment;
DROP POLICY IF EXISTS "Admins can delete equipment" ON equipment;

CREATE POLICY "Users can read equipment for accessible facilities"
  ON equipment FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = equipment.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify equipment"
  ON equipment FOR ALL
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

-- Update documents policies
DROP POLICY IF EXISTS "Authenticated users can read documents" ON documents;
DROP POLICY IF EXISTS "Editors can insert documents" ON documents;
DROP POLICY IF EXISTS "Editors can delete documents" ON documents;

CREATE POLICY "Users can read documents for accessible facilities"
  ON documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      INNER JOIN user_roles ur ON ur.user_id = auth.uid()
      WHERE f.id = documents.facility_id
        AND (
          ur.user_type IN ('admin', 'staff')
          OR (ur.user_type = 'customer' AND ur.organization_id = f.organization_id)
        )
    )
  );

CREATE POLICY "Staff can modify documents"
  ON documents FOR ALL
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

-- Create indexes for organization lookups
CREATE INDEX IF NOT EXISTS idx_facilities_organization_id ON facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_type ON user_roles(user_type);
