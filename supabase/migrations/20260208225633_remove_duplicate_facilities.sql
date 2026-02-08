/*
  # Remove Duplicate Facilities
  
  1. Purpose
    - Removes duplicate facility records created during imports
    - Preserves the oldest facility record for each duplicate group
    - Reassigns all contacts from duplicate facilities to the oldest facility
    - Prevents data loss by migrating all related records
  
  2. Process
    - Identifies duplicate facilities by name
    - For each duplicate group, determines the oldest facility (by created_at)
    - Reassigns all related records from duplicates to the oldest facility
    - Temporarily disables user triggers (not system constraint triggers)
    - Deletes the duplicate facility records
    - Re-enables triggers
  
  3. Tables Updated
    - facility_contacts, milestones, equipment, documents
    - integration_info, regulatory_info, training_info, personnel_info
    - facility_readiness_info, lab_orders, lab_order_confirmations, lab_results
    - stratus_facility_mappings, stratus_orders, trained_personnel
    - responsibilities, notes, notifications, activity_log
    - compliance_events, deficiencies, support_tickets
    - site_equipment, site_test_menu
  
  4. Safety
    - Uses temporary tables to track changes
    - Performs all reassignments before deletions
    - Maintains referential integrity
    - Avoids creating duplicate contacts
*/

-- Temporarily disable user triggers only
ALTER TABLE facilities DISABLE TRIGGER USER;
ALTER TABLE facility_contacts DISABLE TRIGGER USER;

-- Step 1: Create temporary table to identify duplicates and the facility to keep
CREATE TEMP TABLE facility_duplicates AS
WITH ranked_facilities AS (
  SELECT 
    id,
    name,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
  FROM facilities
  WHERE name IN (
    SELECT name 
    FROM facilities 
    GROUP BY name 
    HAVING COUNT(*) > 1
  )
)
SELECT 
  id as duplicate_facility_id,
  name,
  (SELECT id FROM ranked_facilities rf2 WHERE rf2.name = ranked_facilities.name AND rf2.rn = 1) as keep_facility_id
FROM ranked_facilities
WHERE rn > 1;

-- Step 2: Log what we're going to do
DO $$
DECLARE
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO duplicate_count FROM facility_duplicates;
  RAISE NOTICE 'Found % duplicate facilities to remove', duplicate_count;
END $$;

-- Step 3: Reassign facility_contacts to the oldest facility (avoid duplicates)
UPDATE facility_contacts fc
SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd
WHERE fc.facility_id = fd.duplicate_facility_id
AND NOT EXISTS (
  SELECT 1 FROM facility_contacts fc2
  WHERE fc2.facility_id = fd.keep_facility_id
  AND LOWER(fc2.name) = LOWER(fc.name)
  AND (
    (fc2.email IS NOT NULL AND fc.email IS NOT NULL AND LOWER(fc2.email) = LOWER(fc.email))
    OR (fc2.phone IS NOT NULL AND fc.phone IS NOT NULL AND REGEXP_REPLACE(fc2.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(fc.phone, '[^0-9]', '', 'g'))
  )
);

-- Step 4: Delete duplicate contacts that would cause conflicts
DELETE FROM facility_contacts fc
USING facility_duplicates fd
WHERE fc.facility_id = fd.duplicate_facility_id;

-- Step 5: Update all tables that reference facilities
UPDATE activity_log SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE activity_log.facility_id = fd.duplicate_facility_id;

UPDATE compliance_events SET site_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE compliance_events.site_id = fd.duplicate_facility_id;

UPDATE deficiencies SET site_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE deficiencies.site_id = fd.duplicate_facility_id;

UPDATE documents SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE documents.facility_id = fd.duplicate_facility_id;

UPDATE equipment SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE equipment.facility_id = fd.duplicate_facility_id;

UPDATE facility_readiness_info SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE facility_readiness_info.facility_id = fd.duplicate_facility_id;

UPDATE integration_info SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE integration_info.facility_id = fd.duplicate_facility_id;

UPDATE lab_order_confirmations SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE lab_order_confirmations.facility_id = fd.duplicate_facility_id;

UPDATE lab_orders SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE lab_orders.facility_id = fd.duplicate_facility_id;

UPDATE lab_results SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE lab_results.facility_id = fd.duplicate_facility_id;

UPDATE milestones SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE milestones.facility_id = fd.duplicate_facility_id;

UPDATE notes SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE notes.facility_id = fd.duplicate_facility_id;

UPDATE notifications SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE notifications.facility_id = fd.duplicate_facility_id;

UPDATE personnel_info SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE personnel_info.facility_id = fd.duplicate_facility_id;

UPDATE regulatory_info SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE regulatory_info.facility_id = fd.duplicate_facility_id;

UPDATE responsibilities SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE responsibilities.facility_id = fd.duplicate_facility_id;

UPDATE site_equipment SET site_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE site_equipment.site_id = fd.duplicate_facility_id;

UPDATE site_test_menu SET site_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE site_test_menu.site_id = fd.duplicate_facility_id;

UPDATE stratus_facility_mappings SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE stratus_facility_mappings.facility_id = fd.duplicate_facility_id;

UPDATE stratus_orders SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE stratus_orders.facility_id = fd.duplicate_facility_id;

UPDATE support_tickets SET site_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE support_tickets.site_id = fd.duplicate_facility_id;

UPDATE trained_personnel SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE trained_personnel.facility_id = fd.duplicate_facility_id;

UPDATE training_info SET facility_id = fd.keep_facility_id
FROM facility_duplicates fd WHERE training_info.facility_id = fd.duplicate_facility_id;

-- Step 6: Delete duplicate facilities
DELETE FROM facilities
WHERE id IN (SELECT duplicate_facility_id FROM facility_duplicates);

-- Step 7: Log completion
DO $$
DECLARE
  removed_count integer;
BEGIN
  SELECT COUNT(*) INTO removed_count FROM facility_duplicates;
  RAISE NOTICE 'Successfully removed % duplicate facilities', removed_count;
  RAISE NOTICE 'All contacts and related records have been reassigned to the oldest facility';
END $$;

-- Clean up temp table
DROP TABLE facility_duplicates;

-- Re-enable user triggers
ALTER TABLE facilities ENABLE TRIGGER USER;
ALTER TABLE facility_contacts ENABLE TRIGGER USER;
