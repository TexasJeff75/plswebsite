/*
  # Enhance Equipment Table with Full Procurement Lifecycle

  1. Extended Fields in `equipment`
    - Procurement method and details
    - Shipping tracking information
    - Installation details
    - QC and calibration verification
    - Enhanced status tracking
*/

DO $$
BEGIN
  -- Add procurement fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'equipment_type'
  ) THEN
    ALTER TABLE equipment ADD COLUMN equipment_type text; -- 'genexpert', 'clarity', 'epoc', 'abacus', 'laptop'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE equipment ADD COLUMN display_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'required'
  ) THEN
    ALTER TABLE equipment ADD COLUMN required boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'procurement_method'
  ) THEN
    ALTER TABLE equipment ADD COLUMN procurement_method text; -- 'reagent_rental', 'purchase', 'lease'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'order_date'
  ) THEN
    ALTER TABLE equipment ADD COLUMN order_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE equipment ADD COLUMN order_number text;
  END IF;

  -- Add shipping fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'ship_date'
  ) THEN
    ALTER TABLE equipment ADD COLUMN ship_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE equipment ADD COLUMN tracking_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'carrier'
  ) THEN
    ALTER TABLE equipment ADD COLUMN carrier text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'delivery_date'
  ) THEN
    ALTER TABLE equipment ADD COLUMN delivery_date date;
  END IF;

  -- Add installation fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'installed_by'
  ) THEN
    ALTER TABLE equipment ADD COLUMN installed_by text;
  END IF;

  -- Add QC fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'initial_qc_performed'
  ) THEN
    ALTER TABLE equipment ADD COLUMN initial_qc_performed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'initial_qc_date'
  ) THEN
    ALTER TABLE equipment ADD COLUMN initial_qc_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'initial_qc_acceptable'
  ) THEN
    ALTER TABLE equipment ADD COLUMN initial_qc_acceptable boolean;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'calibration_verification_complete'
  ) THEN
    ALTER TABLE equipment ADD COLUMN calibration_verification_complete boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'calibration_verification_date'
  ) THEN
    ALTER TABLE equipment ADD COLUMN calibration_verification_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'equipment_status'
  ) THEN
    ALTER TABLE equipment ADD COLUMN equipment_status text DEFAULT 'not_ordered';
  END IF;

END $$;