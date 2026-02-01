/*
  # Automatic Facility Status Calculation System

  ## Overview
  This migration creates a robust system for automatically calculating and maintaining facility status and completion percentages based on milestone data.

  ## Changes Made

  ### 1. Database Functions
  - `calculate_facility_stats()` - Calculates overall_status and completion_percentage for a facility
    - Returns 'live' if facility has actual_go_live date
    - Returns 'blocked' if any milestone is blocked
    - Returns 'in_progress' if any milestone is in progress
    - Returns 'not_started' otherwise
    - Calculates completion percentage based on completed vs total milestones

  ### 2. Database Triggers
  - `trigger_update_facility_stats_on_milestone_change` - Updates facility stats when milestones are inserted/updated/deleted
  - `trigger_update_facility_stats_on_facility_change` - Updates facility stats when go-live date is set

  ### 3. Data Constraints
  - Add check constraint to ensure status field only contains valid values
  - Valid values: 'Planning', 'In Progress', 'Live', 'On Hold', 'Cancelled'
  - Add check constraint for overall_status: 'not_started', 'in_progress', 'live', 'blocked'

  ### 4. Data Fixes
  - Fix any invalid status values to valid defaults (Pending → Planning)
  - Recalculate and update all existing facility statistics

  ## Security
  - All functions run with SECURITY DEFINER to bypass RLS for calculations
  - Triggers ensure data consistency across all operations
*/

-- Fix any invalid status values FIRST before adding constraints
UPDATE facilities
SET status = 'Planning'
WHERE status IS NOT NULL 
  AND status NOT IN ('Planning', 'In Progress', 'Live', 'On Hold', 'Cancelled');

-- Create function to calculate facility statistics
CREATE OR REPLACE FUNCTION calculate_facility_stats(facility_id_param uuid)
RETURNS TABLE (
  new_overall_status text,
  new_completion_percentage numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_milestones integer;
  completed_milestones integer;
  blocked_count integer;
  in_progress_count integer;
  has_go_live boolean;
BEGIN
  -- Check if facility has gone live
  SELECT actual_go_live IS NOT NULL
  INTO has_go_live
  FROM facilities
  WHERE id = facility_id_param;

  -- If live, return immediately
  IF has_go_live THEN
    RETURN QUERY SELECT 'live'::text, 100::numeric;
    RETURN;
  END IF;

  -- Count milestones by status
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'complete'),
    COUNT(*) FILTER (WHERE status = 'blocked'),
    COUNT(*) FILTER (WHERE status = 'in_progress')
  INTO total_milestones, completed_milestones, blocked_count, in_progress_count
  FROM milestones
  WHERE facility_id = facility_id_param;

  -- Calculate completion percentage
  IF total_milestones > 0 THEN
    new_completion_percentage := ROUND((completed_milestones::numeric / total_milestones::numeric) * 100);
  ELSE
    new_completion_percentage := 0;
  END IF;

  -- Determine overall status
  IF blocked_count > 0 THEN
    new_overall_status := 'blocked';
  ELSIF in_progress_count > 0 THEN
    new_overall_status := 'in_progress';
  ELSIF completed_milestones > 0 THEN
    new_overall_status := 'in_progress';
  ELSE
    new_overall_status := 'not_started';
  END IF;

  RETURN QUERY SELECT new_overall_status, new_completion_percentage;
END;
$$;

-- Create trigger function to update facility stats when milestones change
CREATE OR REPLACE FUNCTION trigger_update_facility_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_facility_id uuid;
  stats_result record;
BEGIN
  -- Determine which facility to update
  IF TG_OP = 'DELETE' THEN
    target_facility_id := OLD.facility_id;
  ELSE
    target_facility_id := NEW.facility_id;
  END IF;

  -- Calculate new stats
  SELECT * INTO stats_result FROM calculate_facility_stats(target_facility_id);

  -- Update facility
  UPDATE facilities
  SET 
    overall_status = stats_result.new_overall_status,
    completion_percentage = stats_result.new_completion_percentage,
    updated_at = now()
  WHERE id = target_facility_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger function to update facility stats when facility changes (e.g., go-live date)
CREATE OR REPLACE FUNCTION trigger_update_facility_stats_on_facility_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats_result record;
BEGIN
  -- Only recalculate if go-live date changed
  IF (OLD.actual_go_live IS NULL AND NEW.actual_go_live IS NOT NULL) OR
     (OLD.actual_go_live IS NOT NULL AND NEW.actual_go_live IS NULL) THEN
    
    SELECT * INTO stats_result FROM calculate_facility_stats(NEW.id);
    
    NEW.overall_status := stats_result.new_overall_status;
    NEW.completion_percentage := stats_result.new_completion_percentage;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_facility_stats_on_milestone_change ON milestones;
DROP TRIGGER IF EXISTS update_facility_stats_on_facility_change ON facilities;

-- Create triggers on milestones table
CREATE TRIGGER update_facility_stats_on_milestone_change
  AFTER INSERT OR UPDATE OR DELETE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_facility_stats();

-- Create trigger on facilities table
CREATE TRIGGER update_facility_stats_on_facility_change
  BEFORE UPDATE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_facility_stats_on_facility_change();

-- Add check constraints for valid status values
DO $$
BEGIN
  -- Add constraint for status field (user-facing statuses)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facilities_status_check'
  ) THEN
    ALTER TABLE facilities
    ADD CONSTRAINT facilities_status_check
    CHECK (status IN ('Planning', 'In Progress', 'Live', 'On Hold', 'Cancelled') OR status IS NULL);
  END IF;

  -- Add constraint for overall_status field (system-calculated statuses)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facilities_overall_status_check'
  ) THEN
    ALTER TABLE facilities
    ADD CONSTRAINT facilities_overall_status_check
    CHECK (overall_status IN ('not_started', 'in_progress', 'live', 'blocked') OR overall_status IS NULL);
  END IF;
END $$;

-- Recalculate all facility stats for existing data
DO $$
DECLARE
  facility_record record;
  stats_result record;
BEGIN
  FOR facility_record IN SELECT id FROM facilities LOOP
    SELECT * INTO stats_result FROM calculate_facility_stats(facility_record.id);
    
    UPDATE facilities
    SET 
      overall_status = stats_result.new_overall_status,
      completion_percentage = stats_result.new_completion_percentage,
      updated_at = now()
    WHERE id = facility_record.id;
  END LOOP;
END $$;
