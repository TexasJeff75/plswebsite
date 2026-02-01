/*
  # Add Priority to Milestones Table

  1. Changes to milestones table
    - Remove `sla_hours` field (no longer relevant)
    - Add `priority` field (1-10 scale, where 1 is highest priority)

  2. Notes
    - Priority indicates urgency/importance of milestone completion
    - Lower priority numbers = higher priority (1 = critical, 10 = low)
    - Default priority is 5 (medium)
*/

-- Remove SLA hours from milestones table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'sla_hours'
  ) THEN
    ALTER TABLE milestones DROP COLUMN sla_hours;
  END IF;
END $$;

-- Add priority field to milestones table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'priority'
  ) THEN
    ALTER TABLE milestones ADD COLUMN priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10);
    COMMENT ON COLUMN milestones.priority IS '1-10 scale where 1 is highest priority';
  END IF;
END $$;

-- Create index on priority for efficient filtering
CREATE INDEX IF NOT EXISTS idx_milestones_priority ON milestones(priority);
