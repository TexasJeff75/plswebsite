/*
  # Create Milestones Table

  1. New Tables
    - `milestones`
      - `id` (uuid, primary key) - Unique identifier
      - `facility_id` (uuid, foreign key) - Reference to facility
      - `milestone_name` (text) - Name of milestone
      - `milestone_order` (integer) - Display order (1-9)
      - `status` (text) - Status (Not Started, In Progress, Complete, Blocked)
      - `start_date` (date) - When work started
      - `completion_date` (date) - When completed
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Milestone Types
    1. Site Assessment Complete
    2. CLIA Certificate Obtained
    3. Lab Director Assigned
    4. Equipment Shipped
    5. Equipment Installed
    6. Network/LIS Integration
    7. Staff Training Complete
    8. Competency Testing Done
    9. Go-Live

  3. Security
    - Enable RLS on `milestones` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  milestone_name text NOT NULL,
  milestone_order integer NOT NULL,
  status text NOT NULL DEFAULT 'Not Started',
  start_date date,
  completion_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('Not Started', 'In Progress', 'Complete', 'Blocked')),
  CONSTRAINT valid_order CHECK (milestone_order >= 1 AND milestone_order <= 9)
);

CREATE INDEX IF NOT EXISTS idx_milestones_facility ON milestones(facility_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_order ON milestones(facility_id, milestone_order);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update milestones"
  ON milestones FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete milestones"
  ON milestones FOR DELETE
  TO authenticated
  USING (true);