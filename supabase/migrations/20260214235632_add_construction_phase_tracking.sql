/*
  # Add Construction Phase Tracking to Facilities

  1. New Columns
    - `milestones.phase` (text) - Categorizes milestones into phases: Construction, Installation, Implementation, Go-Live
    - `facilities.has_construction_phase` (boolean) - Indicates if facility requires construction
    - `facilities.calculated_phase` (text) - Auto-calculated current phase based on milestone progress
  
  2. Phase Values
    - Construction: Room refit, painting, flooring, cabinets, plumbing, lighting, etc.
    - Installation: Equipment delivery, setup, calibration
    - Implementation: Integration, training, regulatory approval
    - Go-Live: Final testing and activation
    - Completed: Project finished
    - Live: Facility operational
  
  3. Automation
    - Function to automatically calculate facility phase based on milestone progress
    - Trigger to update facility phase when milestones change
  
  4. Notes
    - Not all facilities require construction phase
    - Phase calculation considers milestone completion percentage
    - System automatically moves through phases as milestones complete
*/

-- Add phase column to milestones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'phase'
  ) THEN
    ALTER TABLE milestones ADD COLUMN phase text;
    COMMENT ON COLUMN milestones.phase IS 'Phase categorization: Construction, Installation, Implementation, Go-Live';
  END IF;
END $$;

-- Add construction tracking to facilities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'has_construction_phase'
  ) THEN
    ALTER TABLE facilities ADD COLUMN has_construction_phase boolean DEFAULT false;
    COMMENT ON COLUMN facilities.has_construction_phase IS 'Indicates if facility requires construction phase';
  END IF;
END $$;

-- Add calculated phase to facilities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'calculated_phase'
  ) THEN
    ALTER TABLE facilities ADD COLUMN calculated_phase text;
    COMMENT ON COLUMN facilities.calculated_phase IS 'Auto-calculated current phase based on milestone progress';
  END IF;
END $$;

-- Create index on milestone phase for efficient queries
CREATE INDEX IF NOT EXISTS idx_milestones_phase ON milestones(phase) WHERE phase IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_facility_phase ON milestones(facility_id, phase);

-- Function to calculate facility phase based on milestone progress
CREATE OR REPLACE FUNCTION calculate_facility_phase(facility_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_construction boolean;
  construction_complete boolean;
  installation_complete boolean;
  implementation_complete boolean;
  golive_complete boolean;
  facility_live boolean;
  construction_pct numeric;
  installation_pct numeric;
  implementation_pct numeric;
  golive_pct numeric;
BEGIN
  -- Check if facility has construction phase
  SELECT has_construction_phase INTO has_construction
  FROM facilities
  WHERE id = facility_uuid;

  -- If no facility found, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Check if facility is already live
  SELECT actual_go_live IS NOT NULL INTO facility_live
  FROM facilities
  WHERE id = facility_uuid;

  IF facility_live THEN
    RETURN 'Live';
  END IF;

  -- Calculate completion percentages for each phase
  -- Construction phase (only if has_construction_phase is true)
  IF has_construction THEN
    SELECT 
      COUNT(CASE WHEN status = 'Completed' THEN 1 END)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
    INTO construction_pct
    FROM milestones
    WHERE facility_id = facility_uuid
      AND phase = 'Construction';

    construction_complete := COALESCE(construction_pct, 0) >= 100;
  ELSE
    construction_complete := true; -- Skip construction if not needed
  END IF;

  -- Installation phase
  SELECT 
    COUNT(CASE WHEN status = 'Completed' THEN 1 END)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
  INTO installation_pct
  FROM milestones
  WHERE facility_id = facility_uuid
    AND phase = 'Installation';

  installation_complete := COALESCE(installation_pct, 0) >= 100;

  -- Implementation phase
  SELECT 
    COUNT(CASE WHEN status = 'Completed' THEN 1 END)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
  INTO implementation_pct
  FROM milestones
  WHERE facility_id = facility_uuid
    AND phase = 'Implementation';

  implementation_complete := COALESCE(implementation_pct, 0) >= 100;

  -- Go-Live phase
  SELECT 
    COUNT(CASE WHEN status = 'Completed' THEN 1 END)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100
  INTO golive_pct
  FROM milestones
  WHERE facility_id = facility_uuid
    AND phase = 'Go-Live';

  golive_complete := COALESCE(golive_pct, 0) >= 100;

  -- Determine current phase
  IF golive_complete THEN
    RETURN 'Completed';
  ELSIF implementation_complete AND COALESCE(golive_pct, 0) > 0 THEN
    RETURN 'Go-Live';
  ELSIF installation_complete AND COALESCE(implementation_pct, 0) > 0 THEN
    RETURN 'Implementation';
  ELSIF construction_complete AND COALESCE(installation_pct, 0) > 0 THEN
    RETURN 'Installation';
  ELSIF has_construction AND COALESCE(construction_pct, 0) > 0 THEN
    RETURN 'Construction';
  ELSIF has_construction AND NOT construction_complete THEN
    RETURN 'Planning';
  ELSE
    RETURN 'Planning';
  END IF;
END;
$$;

-- Trigger function to update facility phase when milestones change
CREATE OR REPLACE FUNCTION update_facility_phase_on_milestone_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the calculated phase for the affected facility
  UPDATE facilities
  SET calculated_phase = calculate_facility_phase(
    CASE 
      WHEN TG_OP = 'DELETE' THEN OLD.facility_id
      ELSE NEW.facility_id
    END
  ),
  updated_at = now()
  WHERE id = CASE 
    WHEN TG_OP = 'DELETE' THEN OLD.facility_id
    ELSE NEW.facility_id
  END;

  RETURN CASE 
    WHEN TG_OP = 'DELETE' THEN OLD
    ELSE NEW
  END;
END;
$$;

-- Create trigger on milestones to auto-update facility phase
DROP TRIGGER IF EXISTS trigger_update_facility_phase ON milestones;
CREATE TRIGGER trigger_update_facility_phase
  AFTER INSERT OR UPDATE OF status, phase OR DELETE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_phase_on_milestone_change();

-- Trigger to update facility phase when has_construction_phase changes
CREATE OR REPLACE FUNCTION update_facility_phase_on_construction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.calculated_phase = calculate_facility_phase(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_phase_on_construction_change ON facilities;
CREATE TRIGGER trigger_update_phase_on_construction_change
  BEFORE UPDATE OF has_construction_phase ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_phase_on_construction_change();

-- Initialize calculated_phase for existing facilities
UPDATE facilities
SET calculated_phase = calculate_facility_phase(id)
WHERE calculated_phase IS NULL;