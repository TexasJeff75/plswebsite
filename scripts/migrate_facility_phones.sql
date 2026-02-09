/*
  Migration Script: Move Contact Phone Numbers to Facilities

  This script helps clean up phone data by moving phone numbers from
  facility_contacts to facilities where appropriate.

  Run this if you want to ensure all facility phone numbers are
  properly stored in the facilities table.
*/

-- Step 1: Move phone numbers where all contacts have the same phone
WITH most_common_phone AS (
  SELECT
    facility_id,
    phone,
    COUNT(*) as phone_count,
    ROW_NUMBER() OVER (PARTITION BY facility_id ORDER BY COUNT(*) DESC) as rn
  FROM facility_contacts
  WHERE phone IS NOT NULL
  GROUP BY facility_id, phone
)
UPDATE facilities f
SET phone = mcp.phone
FROM most_common_phone mcp
WHERE f.id = mcp.facility_id
  AND mcp.rn = 1
  AND (f.phone IS NULL OR f.phone = '');

-- Step 2: Report on facilities with phone numbers
SELECT
  COUNT(*) as total_facilities,
  COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as facilities_with_phone,
  COUNT(CASE WHEN phone IS NULL THEN 1 END) as facilities_without_phone
FROM facilities;

-- Step 3: Show facilities that might need manual review
-- (where contacts have different phone numbers)
SELECT
  f.id,
  f.name,
  f.phone as facility_phone,
  COUNT(DISTINCT fc.phone) as unique_contact_phones,
  array_agg(DISTINCT fc.phone) as contact_phones
FROM facilities f
INNER JOIN facility_contacts fc ON fc.facility_id = f.id
WHERE fc.phone IS NOT NULL
GROUP BY f.id, f.name, f.phone
HAVING COUNT(DISTINCT fc.phone) > 1
ORDER BY f.name;
