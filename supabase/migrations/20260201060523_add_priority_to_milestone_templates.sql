/*
  # Add priority field to milestone_templates table

  1. Changes
    - Add `priority` field to milestone_templates (1-10 scale, where 1 is highest priority)
    - Default priority is 5 (medium priority)

  2. Notes
    - Priority indicates urgency/importance of milestone completion
    - Lower priority numbers = higher priority (1 = critical, 10 = low)
*/

-- Add priority field to milestone_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestone_templates' AND column_name = 'priority'
  ) THEN
    ALTER TABLE milestone_templates ADD COLUMN priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10);
    COMMENT ON COLUMN milestone_templates.priority IS '1-10 scale where 1 is highest priority';
  END IF;
END $$;

-- Create index on priority for efficient filtering
CREATE INDEX IF NOT EXISTS idx_milestone_templates_priority ON milestone_templates(priority);
