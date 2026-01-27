/*
  # Expand Facilities Table with Deployment Configuration

  1. New Fields in `facilities`
    - `deployment_phase` (enum: phase_1a, phase_1b, phase_2, phase_3, phase_4, phase_5, phase_6)
    - `site_configuration` (enum: waived, moderate)
    - `monthly_service_fee` (750 or 1500)
    - `monthly_lis_saas_fee` (78 or 295)
    - `overall_status` (not_started, in_progress, live, blocked)
    - `completion_percentage` (0-100)
    - `projected_deployment_date`
    - `actual_deployment_date`
    - `service_fee_start_date`
    - `projected_go_live_date` (replaces projected_go_live)
    - `actual_go_live_date` (replaces actual_go_live)
    - `notes`
*/

DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'deployment_phase'
  ) THEN
    ALTER TABLE facilities ADD COLUMN deployment_phase text DEFAULT 'phase_1a';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'site_configuration'
  ) THEN
    ALTER TABLE facilities ADD COLUMN site_configuration text DEFAULT 'waived';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'monthly_service_fee'
  ) THEN
    ALTER TABLE facilities ADD COLUMN monthly_service_fee numeric DEFAULT 750;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'monthly_lis_saas_fee'
  ) THEN
    ALTER TABLE facilities ADD COLUMN monthly_lis_saas_fee numeric DEFAULT 78;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'overall_status'
  ) THEN
    ALTER TABLE facilities ADD COLUMN overall_status text DEFAULT 'not_started';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'completion_percentage'
  ) THEN
    ALTER TABLE facilities ADD COLUMN completion_percentage numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'projected_deployment_date'
  ) THEN
    ALTER TABLE facilities ADD COLUMN projected_deployment_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'actual_deployment_date'
  ) THEN
    ALTER TABLE facilities ADD COLUMN actual_deployment_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'service_fee_start_date'
  ) THEN
    ALTER TABLE facilities ADD COLUMN service_fee_start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'facility_notes'
  ) THEN
    ALTER TABLE facilities ADD COLUMN facility_notes text;
  END IF;
END $$;