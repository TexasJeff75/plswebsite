/*
  # Enhance Milestones and Documents Tables

  1. Enhanced Fields in `milestones`
    - Add category, description, responsible_party
    - Add blocked_reason and blocked_since
    - Add dependencies and sla_hours
    - Add target_date field
  2. Enhanced Fields in `documents`
    - Add expiration_date field
  3. New Table: `activity_log`
    - Audit trail of all facility changes
*/

DO $$
BEGIN
  -- Add milestone fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'category'
  ) THEN
    ALTER TABLE milestones ADD COLUMN category text; -- 'regulatory', 'equipment', 'integration', 'training', 'go_live'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'description'
  ) THEN
    ALTER TABLE milestones ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'responsible_party'
  ) THEN
    ALTER TABLE milestones ADD COLUMN responsible_party text; -- 'AMA', 'Proximity', 'Facility', 'Vendor'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'target_date'
  ) THEN
    ALTER TABLE milestones ADD COLUMN target_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'blocked_reason'
  ) THEN
    ALTER TABLE milestones ADD COLUMN blocked_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'blocked_since'
  ) THEN
    ALTER TABLE milestones ADD COLUMN blocked_since date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'dependencies'
  ) THEN
    ALTER TABLE milestones ADD COLUMN dependencies uuid[] DEFAULT '{}'::uuid[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'sla_hours'
  ) THEN
    ALTER TABLE milestones ADD COLUMN sla_hours numeric;
  END IF;

  -- Add documents expiration_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'expiration_date'
  ) THEN
    ALTER TABLE documents ADD COLUMN expiration_date date;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  
  timestamp timestamptz DEFAULT now(),
  action text NOT NULL, -- 'created', 'updated', 'deleted'
  field_name text,
  old_value text,
  new_value text,
  user_id uuid REFERENCES auth.users(id),
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities
      WHERE facilities.id = activity_log.facility_id
    )
  );

CREATE POLICY "Editors can insert activity log"
  ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Editor'
    )
  );

CREATE INDEX idx_activity_log_facility_id ON activity_log(facility_id);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);