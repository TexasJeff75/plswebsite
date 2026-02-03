/*
  # Add Projects Hierarchy to Deployment Tracker

  ## Overview
  This migration adds a Projects layer between Organizations and Facilities.
  The new hierarchy is: Organization → Project → Facilities
  
  ## New Tables
    - `projects`
      - `id` (uuid, primary key) - Unique identifier
      - `organization_id` (uuid, foreign key) - Reference to parent organization
      - `name` (text) - Project name
      - `description` (text, nullable) - Project description
      - `status` (text) - Project status (planning, active, completed, on_hold, cancelled)
      - `start_date` (date, nullable) - Project start date
      - `target_completion_date` (date, nullable) - Target completion date
      - `actual_completion_date` (date, nullable) - Actual completion date
      - `project_manager` (text, nullable) - Name of project manager
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  ## Changes
    - Add `project_id` to `facilities` table
    - Keep `organization_id` on facilities for backward compatibility and easy querying
    - Add indexes for performance
    - Add RLS policies for projects

  ## Security
    - Enable RLS on projects table
    - Add policies based on organization access
    - Internal users (is_internal=true) can see all projects
    - External users can only see projects in organizations they have access to
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planning',
  start_date date,
  target_completion_date date,
  actual_completion_date date,
  project_manager text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('planning', 'active', 'completed', 'on_hold', 'cancelled'))
);

-- Add project_id to facilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE facilities ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Internal users can read all projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND is_internal = true
    )
  );

CREATE POLICY "External users can read their organization projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_organization_assignments
      WHERE user_id = auth.uid() 
        AND organization_id = projects.organization_id
    )
  );

CREATE POLICY "Admins and editors can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
        AND role IN ('Proximity Admin', 'Admin', 'Editor', 'Account Manager')
    )
  );

CREATE POLICY "Admins and editors can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
        AND role IN ('Proximity Admin', 'Admin', 'Editor', 'Account Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() 
        AND role IN ('Proximity Admin', 'Admin', 'Editor', 'Account Manager')
    )
  );

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('Proximity Admin', 'Admin')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_facilities_project_id ON facilities(project_id);

-- Create a function to automatically set organization_id on facilities when project_id is set
CREATE OR REPLACE FUNCTION set_facility_organization_from_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically set organization_id
DROP TRIGGER IF EXISTS trigger_set_facility_organization ON facilities;
CREATE TRIGGER trigger_set_facility_organization
  BEFORE INSERT OR UPDATE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION set_facility_organization_from_project();
