/*
  # Create User Roles and Responsibilities Tables

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `role` (text) - User role (Admin, Editor, Viewer)
      - `email` (text) - User email for display
      - `display_name` (text) - User display name
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `responsibilities`
      - `id` (uuid, primary key) - Unique identifier
      - `facility_id` (uuid, foreign key) - Reference to facility
      - `milestone_id` (uuid, foreign key) - Optional specific milestone
      - `user_id` (uuid, foreign key) - Assigned user
      - `responsibility_type` (text) - Type of responsibility
      - `notes` (text) - Additional notes
      - `assigned_by` (uuid) - Who made the assignment
      - `assigned_at` (timestamptz) - Assignment timestamp

  2. Roles
    - Admin: Full access to all features
    - Editor: Can edit facilities, milestones, equipment
    - Viewer: Read-only access

  3. Responsibility Types
    - Facility Manager
    - Site Assessor
    - Equipment Installer
    - Trainer
    - Project Manager

  4. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Viewer',
  email text NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_role CHECK (role IN ('Admin', 'Editor', 'Viewer')),
  CONSTRAINT unique_user_role UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responsibility_type text NOT NULL,
  notes text,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  CONSTRAINT valid_responsibility_type CHECK (responsibility_type IN ('Facility Manager', 'Site Assessor', 'Equipment Installer', 'Trainer', 'Project Manager'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_responsibilities_facility ON responsibilities(facility_id);
CREATE INDEX IF NOT EXISTS idx_responsibilities_user ON responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_responsibilities_milestone ON responsibilities(milestone_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Admin'
    )
  );

CREATE POLICY "Authenticated users can read responsibilities"
  ON responsibilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert responsibilities"
  ON responsibilities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update responsibilities"
  ON responsibilities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete responsibilities"
  ON responsibilities FOR DELETE
  TO authenticated
  USING (true);