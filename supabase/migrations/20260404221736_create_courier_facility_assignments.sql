/*
  # Create Courier Facility Assignments Table

  ## Summary
  Creates a table to assign Courier-role users to specific facilities.
  Proximity Staff manage these assignments. The active courier for a facility
  is automatically used when dispatching supply orders.

  ## New Tables
  - `courier_facility_assignments`
    - `id` (uuid, primary key)
    - `courier_user_id` (uuid, FK to user_roles.user_id)
    - `facility_id` (uuid, FK to facilities)
    - `assigned_by` (uuid, FK to user_roles.user_id)
    - `assigned_at` (timestamptz)
    - `is_active` (boolean, default true)
    - UNIQUE on (courier_user_id, facility_id)

  ## Security
  - RLS enabled
  - Proximity Staff can read and write
  - Authenticated users can read (to see who their courier is)
*/

CREATE TABLE IF NOT EXISTS courier_facility_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(courier_user_id, facility_id)
);

CREATE INDEX IF NOT EXISTS idx_courier_facility_assignments_facility_id ON courier_facility_assignments(facility_id);
CREATE INDEX IF NOT EXISTS idx_courier_facility_assignments_courier_user_id ON courier_facility_assignments(courier_user_id);
CREATE INDEX IF NOT EXISTS idx_courier_facility_assignments_is_active ON courier_facility_assignments(is_active);

ALTER TABLE courier_facility_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proximity staff can manage courier assignments"
  ON courier_facility_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Proximity staff can update courier assignments"
  ON courier_facility_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Proximity staff can delete courier assignments"
  ON courier_facility_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist', 'Super Admin')
    )
  );

CREATE POLICY "Authenticated users can view courier assignments"
  ON courier_facility_assignments
  FOR SELECT
  TO authenticated
  USING (true);
