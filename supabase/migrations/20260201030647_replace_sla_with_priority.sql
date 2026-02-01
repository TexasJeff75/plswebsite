/*
  # Replace SLA Hours with Priority Order for Milestones

  1. Changes to milestone_templates
    - Remove `sla_hours` field (no longer relevant)
    - Keep existing `sort_order` for template ordering

  2. Changes to template_milestones
    - Remove `custom_sla_hours_override` field (no longer relevant)
    - Add `priority` field (1-10 scale, where 1 is highest priority)
    - Keep existing `sort_order` for milestone ordering within template

  3. Notes
    - Priority indicates urgency/importance of milestone completion
    - Sort order determines display sequence
    - Lower priority numbers = higher priority (1 = critical, 10 = low)
*/

-- Remove SLA hours from milestone_templates
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestone_templates' AND column_name = 'sla_hours'
  ) THEN
    ALTER TABLE milestone_templates DROP COLUMN sla_hours;
  END IF;
END $$;

-- Remove custom SLA hours override from template_milestones
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_milestones' AND column_name = 'custom_sla_hours_override'
  ) THEN
    ALTER TABLE template_milestones DROP COLUMN custom_sla_hours_override;
  END IF;
END $$;

-- Add priority field to template_milestones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'template_milestones' AND column_name = 'priority'
  ) THEN
    ALTER TABLE template_milestones ADD COLUMN priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10);
    COMMENT ON COLUMN template_milestones.priority IS '1-10 scale where 1 is highest priority';
  END IF;
END $$;

-- Create index on priority for efficient filtering
CREATE INDEX IF NOT EXISTS idx_template_milestones_priority ON template_milestones(priority);
