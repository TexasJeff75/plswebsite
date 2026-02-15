/*
  # Add Automatic Phase Calculation

  1. Database Function
    - `calculate_facility_phase()` - Determines current deployment phase based on milestone progress
      - Returns 'Live' if facility has actual_go_live date
      - Returns 'Construction' if construction phase milestones are in progress
      - Returns 'Installation' if installation phase milestones are in progress  
      - Returns 'Implementation' if implementation phase milestones are in progress
      - Returns 'Go-Live' if go-live phase milestones are in progress
      - Returns 'Completed' if all milestones are complete
      - Returns 'Planning' otherwise

  2. Update Trigger
    - Update existing trigger to also calculate and set the calculated_phase field

  3. Backfill
    - Calculate phase for all existing facilities
*/

-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS calculate_facility_phase(uuid);

-- Create function to calculate facility phase based on milestone progress
CREATE OR REPLACE FUNCTION calculate_facility_phase(facility_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  facility_is_live boolean;
  total_milestones_count integer;
  completed_milestones_count integer;
  facility_has_construction boolean;
  phase_is_active boolean;
BEGIN
  -- Check if facility has gone live
  SELECT 
    actual_go_live IS NOT NULL,
    COALESCE(f.has_construction_phase, false)
  INTO facility_is_live, facility_has_construction
  FROM facilities f
  WHERE f.id = facility_id_param;

  -- If live, return immediately
  IF facility_is_live THEN
    RETURN 'Live';
  END IF;

  -- Count total and completed milestones
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'complete')
  INTO total_milestones_count, completed_milestones_count
  FROM milestones
  WHERE facility_id = facility_id_param;

  -- If all milestones complete but not yet live
  IF total_milestones_count > 0 AND completed_milestones_count = total_milestones_count THEN
    RETURN 'Completed';
  END IF;

  -- Check each phase in order - return the first phase with active milestones
  
  -- Check Construction phase (if applicable)
  IF facility_has_construction THEN
    SELECT COUNT(*) > 0
    INTO phase_is_active
    FROM milestones
    WHERE facility_id = facility_id_param
      AND phase = 'Construction'
      AND status IN ('in_progress', 'blocked', 'not_started');
    
    IF phase_is_active THEN
      RETURN 'Construction';
    END IF;
  END IF;

  -- Check Installation phase
  SELECT COUNT(*) > 0
  INTO phase_is_active
  FROM milestones
  WHERE facility_id = facility_id_param
    AND phase = 'Installation'
    AND status IN ('in_progress', 'blocked', 'not_started');
  
  IF phase_is_active THEN
    RETURN 'Installation';
  END IF;

  -- Check Implementation phase
  SELECT COUNT(*) > 0
  INTO phase_is_active
  FROM milestones
  WHERE facility_id = facility_id_param
    AND phase = 'Implementation'
    AND status IN ('in_progress', 'blocked', 'not_started');
  
  IF phase_is_active THEN
    RETURN 'Implementation';
  END IF;

  -- Check Go-Live phase
  SELECT COUNT(*) > 0
  INTO phase_is_active
  FROM milestones
  WHERE facility_id = facility_id_param
    AND phase = 'Go-Live'
    AND status IN ('in_progress', 'blocked', 'not_started');
  
  IF phase_is_active THEN
    RETURN 'Go-Live';
  END IF;

  -- Default to Planning if no active milestones found
  RETURN 'Planning';
END;
$$;

-- Update the existing trigger function to also calculate phase
CREATE OR REPLACE FUNCTION trigger_update_facility_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_facility_id uuid;
  stats_result record;
  new_phase text;
BEGIN
  -- Determine which facility to update
  IF TG_OP = 'DELETE' THEN
    target_facility_id := OLD.facility_id;
  ELSE
    target_facility_id := NEW.facility_id;
  END IF;

  -- Calculate new stats
  SELECT * INTO stats_result FROM calculate_facility_stats(target_facility_id);
  
  -- Calculate new phase
  new_phase := calculate_facility_phase(target_facility_id);

  -- Update facility
  UPDATE facilities
  SET 
    overall_status = stats_result.new_overall_status,
    completion_percentage = stats_result.new_completion_percentage,
    calculated_phase = new_phase,
    updated_at = now()
  WHERE id = target_facility_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update the facility change trigger to also update phase
CREATE OR REPLACE FUNCTION trigger_update_facility_stats_on_facility_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats_result record;
  new_phase text;
BEGIN
  -- Recalculate if go-live date changed OR has_construction_phase changed
  IF (OLD.actual_go_live IS NULL AND NEW.actual_go_live IS NOT NULL) OR
     (OLD.actual_go_live IS NOT NULL AND NEW.actual_go_live IS NULL) OR
     (OLD.has_construction_phase IS DISTINCT FROM NEW.has_construction_phase) THEN
    
    SELECT * INTO stats_result FROM calculate_facility_stats(NEW.id);
    new_phase := calculate_facility_phase(NEW.id);
    
    NEW.overall_status := stats_result.new_overall_status;
    NEW.completion_percentage := stats_result.new_completion_percentage;
    NEW.calculated_phase := new_phase;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill calculated_phase for all existing facilities
DO $$
DECLARE
  facility_record record;
  new_phase text;
BEGIN
  FOR facility_record IN SELECT id FROM facilities LOOP
    new_phase := calculate_facility_phase(facility_record.id);
    
    UPDATE facilities
    SET 
      calculated_phase = new_phase,
      updated_at = now()
    WHERE id = facility_record.id;
  END LOOP;
END $$;