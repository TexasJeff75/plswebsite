/*
  # Fix RC - HTX Pain commission rule sales rep assignment

  ## Problem
  The "RC - HTX Pain" commission rule had no sales_rep_id assigned (null),
  meaning it was treated as a global rule not tied to Robert Castaneda.
  All HTX Pain invoices are assigned to Robert Castaneda, so this rule
  needs to be linked to his sales rep record.

  ## Changes
  - Assigns sales_rep_id for "RC - HTX Pain", "RC - RCPM", and "RC - PWIK"
    to Robert Castaneda (b6fd3888-9768-48e9-b079-fc161fe31c88)

  ## Notes
  - These three rules all follow the "RC -" naming pattern matching Robert Castaneda
  - Their customer invoices are all assigned to Robert Castaneda's sales rep ID
*/

UPDATE commission_rules
SET sales_rep_id = 'b6fd3888-9768-48e9-b079-fc161fe31c88',
    updated_at = now()
WHERE name IN ('RC - HTX Pain', 'RC - RCPM', 'RC - PWIK')
  AND sales_rep_id IS NULL;
