/*
  # Add Deployment Tracker Hierarchy

  ## Overview
  This migration restructures the deployment tracker to support the proper organizational hierarchy:
  Organization → Project → Facilities

  ## New Tables
    - `deployment_organizations`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Organization name (e.g., "American Medical Administrators")
      - `abbreviation` (text, nullable) - Short name (e.g., "AMA")
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp
    
    - `deployment_projects`
      - `id` (uuid, primary key) - Unique identifier
      - `organization_id` (uuid, foreign key) - Reference to parent organization
      - `name` (text) - Project name (e.g., "AMA (Mini Lab)")
      - `description` (text, nullable) - Project description
      - `status` (text) - Project status (planning, in_progress, completed, on_hold)
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp
    
    - `deployment_facilities`
      - `id` (uuid, primary key) - Unique identifier
      - `project_id` (uuid, foreign key) - Reference to parent project
      - `name` (text) - Facility name
      - `location` (text, nullable) - Physical location/address
      - `status` (text) - Facility status (pending, in_progress, completed, failed)
      - `deployment_date` (timestamptz, nullable) - When deployment occurred
      - `deployed_by` (text, nullable) - Person who deployed
      - `notes` (text, nullable) - Additional notes
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  ## Changes
    - Drop the old flat `deployments` table
    - Create new hierarchical structure
    - Add proper foreign key relationships
    - Add indexes for performance

  ## Security
    - Enable RLS on all tables
    - Add policies for public read and authenticated write operations
*/

-- Drop old deployments table
DROP TABLE IF EXISTS deployments CASCADE;

-- Create deployment_organizations table
CREATE TABLE IF NOT EXISTS deployment_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create deployment_projects table
CREATE TABLE IF NOT EXISTS deployment_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES deployment_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create deployment_facilities table
CREATE TABLE IF NOT EXISTS deployment_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES deployment_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending',
  deployment_date timestamptz,
  deployed_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE deployment_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deployment_organizations
CREATE POLICY "Allow public read access to deployment_organizations"
  ON deployment_organizations
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert deployment_organizations"
  ON deployment_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deployment_organizations"
  ON deployment_organizations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deployment_organizations"
  ON deployment_organizations
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for deployment_projects
CREATE POLICY "Allow public read access to deployment_projects"
  ON deployment_projects
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert deployment_projects"
  ON deployment_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deployment_projects"
  ON deployment_projects
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deployment_projects"
  ON deployment_projects
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for deployment_facilities
CREATE POLICY "Allow public read access to deployment_facilities"
  ON deployment_facilities
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert deployment_facilities"
  ON deployment_facilities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deployment_facilities"
  ON deployment_facilities
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deployment_facilities"
  ON deployment_facilities
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deployment_projects_org_id ON deployment_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_deployment_facilities_project_id ON deployment_facilities(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_facilities_status ON deployment_facilities(status);
CREATE INDEX IF NOT EXISTS idx_deployment_projects_status ON deployment_projects(status);

-- Insert sample data
INSERT INTO deployment_organizations (name, abbreviation) VALUES
  ('American Medical Administrators', 'AMA'),
  ('Global Health Services', 'GHS'),
  ('MedTech Solutions', 'MTS')
ON CONFLICT DO NOTHING;

-- Get organization IDs for sample data
DO $$
DECLARE
  ama_id uuid;
  ghs_id uuid;
  mts_id uuid;
BEGIN
  SELECT id INTO ama_id FROM deployment_organizations WHERE abbreviation = 'AMA' LIMIT 1;
  SELECT id INTO ghs_id FROM deployment_organizations WHERE abbreviation = 'GHS' LIMIT 1;
  SELECT id INTO mts_id FROM deployment_organizations WHERE abbreviation = 'MTS' LIMIT 1;

  -- Insert sample projects
  INSERT INTO deployment_projects (organization_id, name, description, status) VALUES
    (ama_id, 'AMA (Mini Lab)', 'Mini laboratory deployment project for AMA', 'in_progress'),
    (ama_id, 'AMA (Main Facility)', 'Main facility upgrade project', 'planning'),
    (ghs_id, 'GHS (Regional Expansion)', 'Regional expansion initiative', 'in_progress'),
    (mts_id, 'MTS (Equipment Rollout)', 'Medical equipment deployment', 'completed')
  ON CONFLICT DO NOTHING;

  -- Insert sample facilities
  INSERT INTO deployment_facilities (project_id, name, location, status, deployed_by, notes)
  SELECT p.id, 'Facility ' || n.num, 'Location ' || n.num, 
    CASE 
      WHEN n.num % 4 = 0 THEN 'completed'
      WHEN n.num % 4 = 1 THEN 'in_progress'
      WHEN n.num % 4 = 2 THEN 'pending'
      ELSE 'failed'
    END,
    'Admin User',
    'Sample facility ' || n.num
  FROM deployment_projects p
  CROSS JOIN generate_series(1, 3) AS n(num)
  WHERE p.name LIKE 'AMA%'
  ON CONFLICT DO NOTHING;
END $$;
