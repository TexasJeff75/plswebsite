/*
  # Create Milestone Tasks Table

  1. New Table
    - `milestone_tasks`
      - Core task fields (id, subject, description, status, priority)
      - Relationships (facility_id, milestone_id, assigned_to, created_by)
      - Dates (due_date, completed_at, created_at, updated_at)

  2. Security
    - Enable RLS
    - Policies based on facility access through organization assignments

  3. Indexes & Triggers
    - Performance indexes on foreign keys and status
    - Auto-update timestamps
    - Auto-set completed_at on status change

  4. Reference Data
    - Task status and priority options
*/

-- Create milestone_tasks table
CREATE TABLE IF NOT EXISTS milestone_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text DEFAULT 'medium',
  assigned_to uuid REFERENCES user_roles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES user_roles(id),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_facility_id ON milestone_tasks(facility_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_milestone_id ON milestone_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_status ON milestone_tasks(status);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_assigned_to ON milestone_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_milestone_tasks_created_by ON milestone_tasks(created_by);

-- Enable RLS
ALTER TABLE milestone_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for milestone_tasks

-- SELECT: Users can view tasks for facilities they have access to
CREATE POLICY "Users can view tasks for accessible facilities"
  ON milestone_tasks FOR SELECT
  TO authenticated
  USING (
    facility_id IN (
      SELECT f.id FROM facilities f
      LEFT JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      LEFT JOIN user_roles ur ON ur.id = uoa.user_id
      WHERE ur.user_id = auth.uid()
        AND (ur.role IN ('proximity_admin', 'proximity_staff') OR uoa.organization_id = f.organization_id)
    )
  );

-- INSERT: Authenticated users can create tasks for facilities they have access to
CREATE POLICY "Users can create tasks for accessible facilities"
  ON milestone_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    facility_id IN (
      SELECT f.id FROM facilities f
      LEFT JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      LEFT JOIN user_roles ur ON ur.id = uoa.user_id
      WHERE ur.user_id = auth.uid()
        AND (ur.role IN ('proximity_admin', 'proximity_staff') OR uoa.organization_id = f.organization_id)
    )
  );

-- UPDATE: Users can update tasks they created or are assigned to, or if they're admin
CREATE POLICY "Users can update tasks they created or are assigned to"
  ON milestone_tasks FOR UPDATE
  TO authenticated
  USING (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('proximity_admin', 'proximity_staff')
    )
  )
  WITH CHECK (
    created_by IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR assigned_to IN (SELECT id FROM user_roles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('proximity_admin', 'proximity_staff')
    )
  );

-- DELETE: Only admins can delete tasks
CREATE POLICY "Only admins can delete tasks"
  ON milestone_tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('proximity_admin', 'proximity_staff')
    )
  );

-- Add task status options to reference data
INSERT INTO reference_data (category, code, display_name, sort_order, is_active, is_system)
VALUES 
  ('task_status', 'open', 'Open', 1, true, true),
  ('task_status', 'in_progress', 'In Progress', 2, true, true),
  ('task_status', 'completed', 'Completed', 3, true, true),
  ('task_status', 'cancelled', 'Cancelled', 4, true, true)
ON CONFLICT (category, code) DO NOTHING;

-- Add task priority options to reference data
INSERT INTO reference_data (category, code, display_name, sort_order, is_active, is_system)
VALUES 
  ('task_priority', 'low', 'Low', 1, true, true),
  ('task_priority', 'medium', 'Medium', 2, true, true),
  ('task_priority', 'high', 'High', 3, true, true),
  ('task_priority', 'critical', 'Critical', 4, true, true)
ON CONFLICT (category, code) DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_milestone_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_milestone_tasks_updated_at ON milestone_tasks;
CREATE TRIGGER trigger_update_milestone_tasks_updated_at
  BEFORE UPDATE ON milestone_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_milestone_tasks_updated_at();

-- Create trigger to automatically set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = now();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_task_completed_at ON milestone_tasks;
CREATE TRIGGER trigger_set_task_completed_at
  BEFORE UPDATE ON milestone_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_completed_at();