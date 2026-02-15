/*
  # Fix Phase Casing Standardization

  1. Updates
    - Standardize phase values in milestone_templates to use proper casing
    - Standardize phase values in milestones to use proper casing
  
  2. Changes
    - "construction" → "Construction"
    - "installation" → "Installation"
    - "implementation" → "Implementation"
    - "go_live" → "Go-Live"

  This ensures all milestones are properly grouped by phase in the UI.
*/

-- Update milestone templates to use proper casing
UPDATE milestone_templates
SET phase = CASE 
  WHEN LOWER(phase) = 'construction' THEN 'Construction'
  WHEN LOWER(phase) = 'installation' THEN 'Installation'
  WHEN LOWER(phase) = 'implementation' THEN 'Implementation'
  WHEN LOWER(phase) = 'go_live' OR LOWER(phase) = 'go-live' THEN 'Go-Live'
  ELSE phase
END
WHERE phase IS NOT NULL;

-- Update existing milestones to use proper casing
UPDATE milestones
SET phase = CASE 
  WHEN LOWER(phase) = 'construction' THEN 'Construction'
  WHEN LOWER(phase) = 'installation' THEN 'Installation'
  WHEN LOWER(phase) = 'implementation' THEN 'Implementation'
  WHEN LOWER(phase) = 'go_live' OR LOWER(phase) = 'go-live' THEN 'Go-Live'
  ELSE phase
END
WHERE phase IS NOT NULL;
