/*
  # Add Phone Field to Facilities Table

  1. Changes
    - Add `phone` (text) - Main facility contact phone number
    - This will be displayed in the facility's main profile/location card

  2. Notes
    - This is separate from individual contact phone numbers in facility_contacts
    - The field stores the primary facility phone line
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'phone'
  ) THEN
    ALTER TABLE facilities ADD COLUMN phone text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facilities_phone ON facilities(phone);
