/*
  # Create Deployments Tracking Table

  ## Overview
  This migration creates the infrastructure for tracking software deployments across different environments.

  ## New Tables
    - `deployments`
      - `id` (uuid, primary key) - Unique identifier for each deployment
      - `project_name` (text) - Name of the project being deployed
      - `version` (text) - Version number or tag of the deployment
      - `environment` (text) - Target environment (development, staging, production)
      - `status` (text) - Current deployment status (pending, in_progress, completed, failed, rolled_back)
      - `deployment_date` (timestamptz) - When the deployment occurred
      - `deployed_by` (text) - Name/email of person who initiated deployment
      - `notes` (text, nullable) - Additional notes about the deployment
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
    - Enable Row Level Security (RLS) on `deployments` table
    - Add policies for public read access (for dashboard viewing)
    - Add policies for authenticated insert/update operations
*/

CREATE TABLE IF NOT EXISTS deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  version text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  deployment_date timestamptz DEFAULT now(),
  deployed_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to deployments"
  ON deployments
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow authenticated users to insert deployments"
  ON deployments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update deployments"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete deployments"
  ON deployments
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_deployments_date ON deployments(deployment_date DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_project ON deployments(project_name);
