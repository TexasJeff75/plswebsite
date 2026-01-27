/*
  # Add Location Fields to Facilities

  1. Changes
    - Add `city` (text) - City where facility is located
    - Add `state` (text) - State/province where facility is located
    - Add `latitude` (numeric) - Latitude coordinate for map display
    - Add `longitude` (numeric) - Longitude coordinate for map display
    - Add `address` (text) - Full street address
    - Add `county` (text) - County for additional location context

  2. Notes
    - These fields enable geographic visualization on maps
    - Coordinates allow precise marker placement
    - Address fields support detailed facility information
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'city'
  ) THEN
    ALTER TABLE facilities ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'state'
  ) THEN
    ALTER TABLE facilities ADD COLUMN state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE facilities ADD COLUMN latitude numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE facilities ADD COLUMN longitude numeric(11, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'address'
  ) THEN
    ALTER TABLE facilities ADD COLUMN address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'county'
  ) THEN
    ALTER TABLE facilities ADD COLUMN county text;
  END IF;
END $$;

-- Create index on location fields for better query performance
CREATE INDEX IF NOT EXISTS idx_facilities_city ON facilities(city);
CREATE INDEX IF NOT EXISTS idx_facilities_state ON facilities(state);
CREATE INDEX IF NOT EXISTS idx_facilities_coordinates ON facilities(latitude, longitude);