/*
  # Add Training Date to Trained Personnel

  1. Changes
    - Add `training_date` column to `trained_personnel` table
    - This column stores the date when the person completed their training
    - Used for certificate generation

  2. Notes
    - Column is nullable to support existing records
    - Date type used for calendar date without time
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trained_personnel' AND column_name = 'training_date'
  ) THEN
    ALTER TABLE trained_personnel ADD COLUMN training_date date;
  END IF;
END $$;
