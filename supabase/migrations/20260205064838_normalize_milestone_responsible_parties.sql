/*
  # Normalize Milestone Responsible Party Values

  1. Updates
    - Normalize existing milestone responsible_party values to match standard options
    - Convert lowercase or inconsistent values to proper case: AMA, Proximity, Facility, Vendor
  
  2. Notes
    - This ensures all existing milestones use consistent responsible party values
    - Case-insensitive matching to catch variations like 'ama', 'AMA', 'Ama'
*/

-- Normalize responsible_party values in milestones table
UPDATE milestones
SET responsible_party = CASE
  WHEN LOWER(responsible_party) = 'ama' THEN 'AMA'
  WHEN LOWER(responsible_party) = 'proximity' THEN 'Proximity'
  WHEN LOWER(responsible_party) = 'facility' THEN 'Facility'
  WHEN LOWER(responsible_party) = 'vendor' THEN 'Vendor'
  ELSE responsible_party
END
WHERE responsible_party IS NOT NULL
  AND responsible_party != '';

-- Update milestone_templates to ensure consistent responsible_party_default values
UPDATE milestone_templates
SET responsible_party_default = CASE
  WHEN LOWER(responsible_party_default) = 'ama' THEN 'AMA'
  WHEN LOWER(responsible_party_default) = 'proximity' THEN 'Proximity'
  WHEN LOWER(responsible_party_default) = 'facility' THEN 'Facility'
  WHEN LOWER(responsible_party_default) = 'vendor' THEN 'Vendor'
  ELSE responsible_party_default
END
WHERE responsible_party_default IS NOT NULL
  AND responsible_party_default != '';