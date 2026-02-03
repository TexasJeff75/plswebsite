/*
  # Add ZIP code column to facilities table

  1. Changes
    - Add `zip` column to `facilities` table to store ZIP/postal codes
    - Column is nullable to allow existing records without ZIP codes
    - Uses text type to support various ZIP code formats (ZIP, ZIP+4, international)

  2. Notes
    - No data migration needed - existing facilities will have NULL zip values
    - Applications can optionally populate this field
*/

-- Add zip column to facilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'zip'
  ) THEN
    ALTER TABLE facilities ADD COLUMN zip text;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN facilities.zip IS 'ZIP or postal code for the facility address';
