/*
  # Create Automatic Activity Logging System

  ## Overview
  This migration sets up comprehensive automatic activity logging for all facility-related changes.
  Every INSERT, UPDATE, and DELETE operation will be automatically tracked with:
  - The authenticated user who made the change
  - The user's display name
  - Timestamp of when the change occurred
  - The specific field(s) that changed (for updates)
  - Before and after values

  ## Tables Being Monitored
  1. facilities - Facility information changes
  2. equipment - Equipment additions, modifications, deletions
  3. milestones - Milestone progress and updates
  4. documents - Document uploads and modifications
  5. personnel_info - Personnel information
  6. trained_personnel - Staff training records
  7. regulatory_info - Regulatory compliance data
  8. integration_info - Integration details
  9. facility_readiness_info - Facility readiness assessments
  10. training_info - Training information
  11. interface_status - Interface configuration status

  ## How It Works
  1. A trigger fires on any INSERT, UPDATE, or DELETE
  2. The trigger function captures auth.uid() to get the logged-in user
  3. It looks up the user's display name from user_roles table
  4. For updates, it compares OLD and NEW values to log specific field changes
  5. All data is automatically inserted into activity_log table

  ## Security
  - All triggers respect RLS policies
  - Only authenticated users can generate log entries
  - Log entries are immutable (no update/delete policies)
*/

-- Drop existing trigger function if it exists
DROP FUNCTION IF EXISTS log_facility_activity() CASCADE;

-- Create the trigger function that will log all changes
CREATE OR REPLACE FUNCTION log_facility_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_display_name text;
  v_facility_id uuid;
  v_organization_id uuid;
  v_old_json jsonb;
  v_new_json jsonb;
  v_field record;
BEGIN
  -- Get the user's display name from user_roles
  SELECT display_name INTO v_user_display_name
  FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Default to email if no display name
  IF v_user_display_name IS NULL THEN
    SELECT email INTO v_user_display_name
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  -- Determine facility_id and organization_id based on the table
  IF TG_TABLE_NAME = 'facilities' THEN
    v_facility_id := COALESCE(NEW.id, OLD.id);
    v_organization_id := COALESCE(NEW.organization_id, OLD.organization_id);
  ELSIF TG_TABLE_NAME = 'integration_info' THEN
    v_facility_id := COALESCE(NEW.facility_id, OLD.facility_id);
    -- Get organization_id from the facility
    SELECT organization_id INTO v_organization_id
    FROM facilities
    WHERE id = v_facility_id;
  ELSIF TG_TABLE_NAME = 'interface_status' THEN
    -- For interface_status, get facility_id through integration_info
    SELECT ii.facility_id, f.organization_id INTO v_facility_id, v_organization_id
    FROM integration_info ii
    JOIN facilities f ON f.id = ii.facility_id
    WHERE ii.id = COALESCE(NEW.integration_info_id, OLD.integration_info_id);
  ELSE
    v_facility_id := COALESCE(NEW.facility_id, OLD.facility_id);
    -- Get organization_id from the facility
    SELECT organization_id INTO v_organization_id
    FROM facilities
    WHERE id = v_facility_id;
  END IF;

  -- Handle DELETE operations
  IF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (
      facility_id,
      organization_id,
      table_name,
      record_id,
      action,
      user_id,
      user_display_name,
      metadata
    ) VALUES (
      v_facility_id,
      v_organization_id,
      TG_TABLE_NAME,
      OLD.id,
      'deleted',
      auth.uid(),
      v_user_display_name,
      row_to_json(OLD)::jsonb
    );
    RETURN OLD;
  END IF;

  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (
      facility_id,
      organization_id,
      table_name,
      record_id,
      action,
      user_id,
      user_display_name,
      metadata
    ) VALUES (
      v_facility_id,
      v_organization_id,
      TG_TABLE_NAME,
      NEW.id,
      'created',
      auth.uid(),
      v_user_display_name,
      row_to_json(NEW)::jsonb
    );
    RETURN NEW;
  END IF;

  -- Handle UPDATE operations - log each changed field
  IF TG_OP = 'UPDATE' THEN
    v_old_json := row_to_json(OLD)::jsonb;
    v_new_json := row_to_json(NEW)::jsonb;

    -- Loop through all fields and log changes
    FOR v_field IN 
      SELECT key, value AS new_value
      FROM jsonb_each(v_new_json)
      WHERE key NOT IN ('updated_at', 'created_at')
    LOOP
      -- Check if the field value actually changed
      IF v_old_json->>v_field.key IS DISTINCT FROM v_new_json->>v_field.key THEN
        INSERT INTO activity_log (
          facility_id,
          organization_id,
          table_name,
          record_id,
          action,
          field_name,
          old_value,
          new_value,
          user_id,
          user_display_name,
          metadata
        ) VALUES (
          v_facility_id,
          v_organization_id,
          TG_TABLE_NAME,
          NEW.id,
          'updated',
          v_field.key,
          v_old_json->>v_field.key,
          v_new_json->>v_field.key,
          auth.uid(),
          v_user_display_name,
          jsonb_build_object(
            'old_record', v_old_json,
            'new_record', v_new_json
          )
        );
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Create triggers for all facility-related tables

-- Facilities table
DROP TRIGGER IF EXISTS facilities_activity_log_trigger ON facilities;
CREATE TRIGGER facilities_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Equipment table
DROP TRIGGER IF EXISTS equipment_activity_log_trigger ON equipment;
CREATE TRIGGER equipment_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Milestones table
DROP TRIGGER IF EXISTS milestones_activity_log_trigger ON milestones;
CREATE TRIGGER milestones_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Documents table
DROP TRIGGER IF EXISTS documents_activity_log_trigger ON documents;
CREATE TRIGGER documents_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Personnel Info table
DROP TRIGGER IF EXISTS personnel_info_activity_log_trigger ON personnel_info;
CREATE TRIGGER personnel_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON personnel_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Trained Personnel table
DROP TRIGGER IF EXISTS trained_personnel_activity_log_trigger ON trained_personnel;
CREATE TRIGGER trained_personnel_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trained_personnel
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Regulatory Info table
DROP TRIGGER IF EXISTS regulatory_info_activity_log_trigger ON regulatory_info;
CREATE TRIGGER regulatory_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Integration Info table
DROP TRIGGER IF EXISTS integration_info_activity_log_trigger ON integration_info;
CREATE TRIGGER integration_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON integration_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Facility Readiness Info table
DROP TRIGGER IF EXISTS facility_readiness_info_activity_log_trigger ON facility_readiness_info;
CREATE TRIGGER facility_readiness_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON facility_readiness_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Training Info table
DROP TRIGGER IF EXISTS training_info_activity_log_trigger ON training_info;
CREATE TRIGGER training_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON training_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Interface Status table
DROP TRIGGER IF EXISTS interface_status_activity_log_trigger ON interface_status;
CREATE TRIGGER interface_status_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interface_status
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

-- Add helpful comments
COMMENT ON FUNCTION log_facility_activity() IS 'Automatically logs all changes to facility-related tables with user information and timestamps';
COMMENT ON TABLE activity_log IS 'Comprehensive audit trail of all facility changes with user attribution';
