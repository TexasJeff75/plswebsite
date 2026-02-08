/*
  # Fix Merge Facilities Function - Disable Triggers During Merge

  1. Changes
    - Temporarily disable activity logging triggers during merge operation
    - Re-enable triggers after merge completes
    - Create a single consolidated activity log entry for the merge action
    
  2. Security
    - Function runs with SECURITY DEFINER
    - Only callable by Proximity Admins
    - Triggers are only disabled within the function's transaction scope
*/

CREATE OR REPLACE FUNCTION merge_facilities(
  source_facility_id uuid,
  target_facility_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_display_name text;
  v_records_moved integer := 0;
  v_count integer;
  v_result json;
  v_source_name text;
  v_target_name text;
  v_organization_id uuid;
BEGIN
  -- Check user role
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = auth.uid();

  IF v_user_role != 'Proximity Admin' THEN
    RAISE EXCEPTION 'Only Proximity Admins can merge facilities';
  END IF;

  -- Validate inputs
  IF source_facility_id = target_facility_id THEN
    RAISE EXCEPTION 'Source and target facilities must be different';
  END IF;

  -- Get facility names and organization for logging
  SELECT name, organization_id INTO v_source_name, v_organization_id
  FROM facilities WHERE id = source_facility_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source facility not found';
  END IF;

  SELECT name INTO v_target_name
  FROM facilities WHERE id = target_facility_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target facility not found';
  END IF;

  -- Get user display name for logging
  SELECT display_name INTO v_user_display_name
  FROM user_roles
  WHERE user_id = auth.uid();

  -- Temporarily disable triggers on all tables
  ALTER TABLE activity_log DISABLE TRIGGER ALL;
  ALTER TABLE documents DISABLE TRIGGER ALL;
  ALTER TABLE equipment DISABLE TRIGGER ALL;
  ALTER TABLE facilities DISABLE TRIGGER ALL;
  ALTER TABLE facility_contacts DISABLE TRIGGER ALL;
  ALTER TABLE facility_readiness_info DISABLE TRIGGER ALL;
  ALTER TABLE integration_info DISABLE TRIGGER ALL;
  ALTER TABLE lab_order_confirmations DISABLE TRIGGER ALL;
  ALTER TABLE lab_orders DISABLE TRIGGER ALL;
  ALTER TABLE lab_results DISABLE TRIGGER ALL;
  ALTER TABLE milestones DISABLE TRIGGER ALL;
  ALTER TABLE notes DISABLE TRIGGER ALL;
  ALTER TABLE notifications DISABLE TRIGGER ALL;
  ALTER TABLE personnel_info DISABLE TRIGGER ALL;
  ALTER TABLE regulatory_info DISABLE TRIGGER ALL;
  ALTER TABLE responsibilities DISABLE TRIGGER ALL;
  ALTER TABLE stratus_facility_mappings DISABLE TRIGGER ALL;
  ALTER TABLE stratus_orders DISABLE TRIGGER ALL;
  ALTER TABLE trained_personnel DISABLE TRIGGER ALL;
  ALTER TABLE training_info DISABLE TRIGGER ALL;

  -- Perform all updates
  UPDATE activity_log 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE documents 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE equipment 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE facility_contacts 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE facility_readiness_info 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE integration_info 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_order_confirmations 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_orders 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_results 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE milestones 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE notes 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE notifications 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE personnel_info 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE regulatory_info 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE responsibilities 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE stratus_facility_mappings 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE stratus_orders 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE trained_personnel 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE training_info 
  SET facility_id = target_facility_id 
  WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  -- Delete the source facility
  DELETE FROM facilities WHERE id = source_facility_id;

  -- Re-enable triggers
  ALTER TABLE activity_log ENABLE TRIGGER ALL;
  ALTER TABLE documents ENABLE TRIGGER ALL;
  ALTER TABLE equipment ENABLE TRIGGER ALL;
  ALTER TABLE facilities ENABLE TRIGGER ALL;
  ALTER TABLE facility_contacts ENABLE TRIGGER ALL;
  ALTER TABLE facility_readiness_info ENABLE TRIGGER ALL;
  ALTER TABLE integration_info ENABLE TRIGGER ALL;
  ALTER TABLE lab_order_confirmations ENABLE TRIGGER ALL;
  ALTER TABLE lab_orders ENABLE TRIGGER ALL;
  ALTER TABLE lab_results ENABLE TRIGGER ALL;
  ALTER TABLE milestones ENABLE TRIGGER ALL;
  ALTER TABLE notes ENABLE TRIGGER ALL;
  ALTER TABLE notifications ENABLE TRIGGER ALL;
  ALTER TABLE personnel_info ENABLE TRIGGER ALL;
  ALTER TABLE regulatory_info ENABLE TRIGGER ALL;
  ALTER TABLE responsibilities ENABLE TRIGGER ALL;
  ALTER TABLE stratus_facility_mappings ENABLE TRIGGER ALL;
  ALTER TABLE stratus_orders ENABLE TRIGGER ALL;
  ALTER TABLE trained_personnel ENABLE TRIGGER ALL;
  ALTER TABLE training_info ENABLE TRIGGER ALL;

  -- Create a single consolidated activity log entry for the merge
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
    target_facility_id,
    v_organization_id,
    'facilities',
    target_facility_id,
    'merged',
    auth.uid(),
    v_user_display_name,
    jsonb_build_object(
      'source_facility_id', source_facility_id,
      'source_facility_name', v_source_name,
      'target_facility_id', target_facility_id,
      'target_facility_name', v_target_name,
      'records_moved', v_records_moved
    )
  );

  -- Build result
  v_result := json_build_object(
    'success', true,
    'records_moved', v_records_moved,
    'source_facility_id', source_facility_id,
    'source_facility_name', v_source_name,
    'target_facility_id', target_facility_id,
    'target_facility_name', v_target_name
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION merge_facilities TO authenticated;

COMMENT ON FUNCTION merge_facilities IS 'Merges all related records from source facility to target facility, then deletes the source facility. Only accessible to Proximity Admins. Temporarily disables activity logging triggers during merge to prevent foreign key violations.';
