/*
  # Create Deployment Tracker Schema

  1. New Tables
    - `user_roles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text)
      - `display_name` (text)
      - `role` (text) - Admin, Editor, or Viewer
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `facilities`
      - `id` (uuid, primary key)
      - `name` (text) - Facility name
      - `region` (text) - Geographic region
      - `phase` (text) - Deployment phase
      - `status` (text) - Current status
      - `projected_go_live` (date) - Expected go-live date
      - `actual_go_live` (date) - Actual go-live date
      - `created_by` (uuid, references user_roles)
      - `updated_by` (uuid, references user_roles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `milestones`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities)
      - `name` (text)
      - `milestone_order` (integer)
      - `status` (text) - Not Started, In Progress, Complete, Blocked
      - `start_date` (date)
      - `completion_date` (date)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `equipment`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities)
      - `name` (text)
      - `serial_number` (text)
      - `status` (text)
      - `shipped_date` (date)
      - `delivered_date` (date)
      - `installed_date` (date)
      - `validated_date` (date)
      - `trained_date` (date)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `notes`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities)
      - `milestone_id` (uuid, references milestones, nullable)
      - `content` (text)
      - `created_by` (uuid, references user_roles)
      - `created_at` (timestamptz)
    
    - `documents`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities)
      - `name` (text)
      - `url` (text)
      - `type` (text)
      - `uploaded_by` (uuid, references user_roles)
      - `created_at` (timestamptz)
    
    - `responsibilities`
      - `id` (uuid, primary key)
      - `facility_id` (uuid, references facilities)
      - `user_id` (uuid, references user_roles)
      - `role` (text) - Role/responsibility type
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read all data
    - Only Editors and Admins can modify data
    - User roles are managed by Admins only
*/

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'Viewer',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert user roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admins can update user roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- Create facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  region text,
  phase text,
  status text DEFAULT 'Planning',
  projected_go_live date,
  actual_go_live date,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert facilities"
  ON facilities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Editors can update facilities"
  ON facilities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  milestone_order integer NOT NULL,
  status text DEFAULT 'Not Started',
  start_date date,
  completion_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Editors can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Admins can delete milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- Create equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  serial_number text,
  status text DEFAULT 'Ordered',
  shipped_date date,
  delivered_date date,
  installed_date date,
  validated_date date,
  trained_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert equipment"
  ON equipment FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Editors can update equipment"
  ON equipment FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Admins can delete equipment"
  ON equipment FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE NOT NULL,
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'Admin'
    )
  );

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  type text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Editors can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

-- Create responsibilities table
CREATE TABLE IF NOT EXISTS responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_roles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE responsibilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read responsibilities"
  ON responsibilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Editors can insert responsibilities"
  ON responsibilities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

CREATE POLICY "Editors can delete responsibilities"
  ON responsibilities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Editor', 'Admin')
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_region ON facilities(region);
CREATE INDEX IF NOT EXISTS idx_facilities_phase ON facilities(phase);
CREATE INDEX IF NOT EXISTS idx_milestones_facility_id ON milestones(facility_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_equipment_facility_id ON equipment(facility_id);
CREATE INDEX IF NOT EXISTS idx_notes_facility_id ON notes(facility_id);
CREATE INDEX IF NOT EXISTS idx_notes_milestone_id ON notes(milestone_id);
CREATE INDEX IF NOT EXISTS idx_documents_facility_id ON documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_responsibilities_facility_id ON responsibilities(facility_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Create function to automatically create user_role entry when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'Viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically add user to user_roles table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
