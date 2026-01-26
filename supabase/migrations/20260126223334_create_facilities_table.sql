/*
  # Create Facilities Table

  1. New Tables
    - `facilities`
      - `id` (uuid, primary key) - Unique identifier for facility
      - `name` (text) - Facility name
      - `address` (text) - Street address
      - `city` (text) - City
      - `state` (text) - State abbreviation
      - `zip` (text) - ZIP code
      - `county` (text) - County name
      - `region` (text) - Geographic region
      - `phase` (text) - Deployment phase (Phase 1, Phase 2, Phase 3)
      - `status` (text) - Overall facility status (Not Started, In Progress, Live, Blocked)
      - `projected_go_live` (date) - Projected go-live date
      - `actual_go_live` (date) - Actual go-live date
      - `latitude` (numeric) - Latitude for mapping
      - `longitude` (numeric) - Longitude for mapping
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_by` (uuid) - User who created the record
      - `updated_by` (uuid) - User who last updated the record

  2. Security
    - Enable RLS on `facilities` table
    - Add policy for authenticated users to read all facilities
    - Add policy for authenticated users to insert facilities
    - Add policy for authenticated users to update facilities
    - Add policy for authenticated users to delete facilities
*/

CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  county text,
  region text NOT NULL,
  phase text NOT NULL DEFAULT 'Phase 1',
  status text NOT NULL DEFAULT 'Not Started',
  projected_go_live date,
  actual_go_live date,
  latitude numeric,
  longitude numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_region ON facilities(region);
CREATE INDEX IF NOT EXISTS idx_facilities_phase ON facilities(phase);
CREATE INDEX IF NOT EXISTS idx_facilities_go_live ON facilities(projected_go_live);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all facilities"
  ON facilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert facilities"
  ON facilities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update facilities"
  ON facilities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete facilities"
  ON facilities FOR DELETE
  TO authenticated
  USING (true);