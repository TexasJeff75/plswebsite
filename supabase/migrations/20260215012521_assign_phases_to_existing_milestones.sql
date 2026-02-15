/*
  # Assign Phases to Existing Milestones

  1. Updates
    - Assign phases to existing milestones based on their names matching milestone templates
    - Fallback to category-based phase assignment for milestones without matching templates
  
  2. Changes
    - Match milestones to milestone templates by name and assign their phases
    - Construction milestones → Construction phase
    - Equipment milestones → Installation phase
    - Regulatory/Integration milestones → Implementation phase
    - Training/Go-Live milestones → Go-Live phase

  This ensures all existing milestones are properly grouped by phase in the UI.
*/

-- First, assign phases to milestones that match milestone template names
UPDATE milestones m
SET phase = mt.phase
FROM milestone_templates mt
WHERE m.name = mt.title
  AND m.phase IS NULL
  AND mt.phase IS NOT NULL;

-- For remaining milestones without phases, assign based on category
UPDATE milestones
SET phase = CASE 
  WHEN category = 'construction' THEN 'Construction'
  WHEN category = 'equipment' AND (
    LOWER(name) LIKE '%order%' OR 
    LOWER(name) LIKE '%install%' OR 
    LOWER(name) LIKE '%delivery%'
  ) THEN 'Installation'
  WHEN category = 'equipment' AND (
    LOWER(name) LIKE '%validate%' OR 
    LOWER(name) LIKE '%test%' OR 
    LOWER(name) LIKE '%integrate%'
  ) THEN 'Implementation'
  WHEN category = 'regulatory' THEN 'Implementation'
  WHEN category = 'integration' THEN 'Implementation'
  WHEN category = 'training' THEN 'Go-Live'
  WHEN category = 'go_live' THEN 'Go-Live'
  ELSE NULL
END
WHERE phase IS NULL;

-- Update any remaining equipment milestones to Installation as a fallback
UPDATE milestones
SET phase = 'Installation'
WHERE category = 'equipment' AND phase IS NULL;
