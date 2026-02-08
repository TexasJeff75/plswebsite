/*
  # Create Facility Contacts System

  1. New Tables
    - `facility_contacts`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, foreign key to facilities)
      - `name` (text, required) - Contact's full name
      - `role` (text, required) - Contact's role/position
      - `phone` (text) - Phone number
      - `email` (text) - Email address
      - `is_primary` (boolean) - Whether this is the primary contact
      - `notes` (text) - Additional notes about the contact
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to user_roles)
      - `updated_by` (uuid, foreign key to user_roles)

  2. Reference Data
    - Add contact roles to `reference_data` table

  3. Security
    - Enable RLS on `facility_contacts` table
    - Add policies for authenticated users to manage contacts based on organization access
    - Add indexes for performance

  4. Important Notes
    - Contacts are facility-specific
    - Multiple contacts can be assigned to a facility
    - Only one primary contact per facility is recommended
    - Phone and email are optional but recommended
*/

-- Create facility_contacts table
CREATE TABLE IF NOT EXISTS facility_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  email text,
  is_primary boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_roles(id),
  updated_by uuid REFERENCES user_roles(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_facility_contacts_facility_id ON facility_contacts(facility_id);
CREATE INDEX IF NOT EXISTS idx_facility_contacts_role ON facility_contacts(role);
CREATE INDEX IF NOT EXISTS idx_facility_contacts_is_primary ON facility_contacts(facility_id, is_primary) WHERE is_primary = true;

-- Add contact roles to reference_data
INSERT INTO reference_data (category, code, display_name, description, is_active, sort_order)
VALUES
  ('contact_role', 'nurse_practitioner', 'Nurse Practitioner', 'Licensed nurse practitioner', true, 1),
  ('contact_role', 'physician', 'Physician', 'Medical doctor', true, 2),
  ('contact_role', 'medical_director', 'Medical Director', 'Medical director or chief medical officer', true, 3),
  ('contact_role', 'nurse', 'Nurse', 'Registered nurse', true, 4),
  ('contact_role', 'director_of_nursing', 'Director of Nursing', 'Nursing director or manager', true, 5),
  ('contact_role', 'medical_assistant', 'Medical Assistant', 'Medical assistant', true, 6),
  ('contact_role', 'courier', 'Courier', 'Specimen courier or delivery personnel', true, 7),
  ('contact_role', 'administrator', 'Administrator', 'Facility administrator', true, 8),
  ('contact_role', 'lab_coordinator', 'Lab Coordinator', 'Laboratory coordinator', true, 9),
  ('contact_role', 'other', 'Other', 'Other contact role', true, 99)
ON CONFLICT (category, code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

-- Enable RLS
ALTER TABLE facility_contacts ENABLE ROW LEVEL SECURITY;

-- Create helper function to check facility access via contacts
CREATE OR REPLACE FUNCTION has_facility_access_via_contacts(check_facility_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value text;
  org_id uuid;
BEGIN
  -- Get user role from user_roles table
  SELECT role INTO user_role_value
  FROM user_roles
  WHERE user_id = auth.uid();

  -- Proximity staff can access all facilities
  IF user_role_value IN ('Proximity Admin', 'Proximity Staff') THEN
    RETURN true;
  END IF;

  -- Get the organization_id for the facility
  SELECT organization_id INTO org_id
  FROM facilities
  WHERE id = check_facility_id;

  -- Check if user has access to the facility's organization
  RETURN EXISTS (
    SELECT 1
    FROM user_organization_assignments uoa
    INNER JOIN user_roles ur ON ur.id = uoa.user_role_id
    WHERE ur.user_id = auth.uid()
      AND uoa.organization_id = org_id
      AND uoa.can_view_facilities = true
  );
END;
$$;

-- RLS Policies for facility_contacts

-- SELECT: Users can view contacts for facilities they have access to
CREATE POLICY "Users can view facility contacts they have access to"
  ON facility_contacts
  FOR SELECT
  TO authenticated
  USING (has_facility_access_via_contacts(facility_id));

-- INSERT: Users can add contacts to facilities they have access to
CREATE POLICY "Users can add contacts to accessible facilities"
  ON facility_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_facility_access_via_contacts(facility_id));

-- UPDATE: Users can update contacts for facilities they have access to
CREATE POLICY "Users can update contacts for accessible facilities"
  ON facility_contacts
  FOR UPDATE
  TO authenticated
  USING (has_facility_access_via_contacts(facility_id))
  WITH CHECK (has_facility_access_via_contacts(facility_id));

-- DELETE: Users can delete contacts for facilities they have access to
CREATE POLICY "Users can delete contacts for accessible facilities"
  ON facility_contacts
  FOR DELETE
  TO authenticated
  USING (has_facility_access_via_contacts(facility_id));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_facility_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facility_contacts_updated_at
  BEFORE UPDATE ON facility_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_contacts_updated_at();