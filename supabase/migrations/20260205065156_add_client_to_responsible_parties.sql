/*
  # Add Client to Responsible Party Options

  1. Updates
    - Normalize "client" to "Client" in milestone_templates
    - Ensures all responsible party values use proper case
  
  2. Notes
    - Adds support for "Client" as a valid responsible party option
*/

-- Normalize "client" to "Client" in milestone_templates
UPDATE milestone_templates
SET responsible_party_default = 'Client'
WHERE LOWER(responsible_party_default) = 'client';

-- Normalize any existing "client" values in milestones table
UPDATE milestones
SET responsible_party = 'Client'
WHERE LOWER(responsible_party) = 'client';