/*
  # Fix Merge Facilities Function - Proximity Admin Only

  1. Changes
    - Update `merge_facilities` function to only allow Proximity Admin role
    - Previously checked for 'Editor' and 'Admin' which don't exist in the system
    - Now checks for 'Proximity Admin' only

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only callable by authenticated users with Proximity Admin role
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
  v_records_moved integer := 0;
  v_count integer;
  v_result json;
BEGIN
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = auth.uid();

  IF v_user_role != 'Proximity Admin' THEN
    RAISE EXCEPTION 'Only Proximity Admins can merge facilities';
  END IF;

  IF source_facility_id = target_facility_id THEN
    RAISE EXCEPTION 'Source and target facilities must be different';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = source_facility_id) THEN
    RAISE EXCEPTION 'Source facility not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM facilities WHERE id = target_facility_id) THEN
    RAISE EXCEPTION 'Target facility not found';
  END IF;

  UPDATE activity_log SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE documents SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE equipment SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE facility_contacts SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE facility_readiness_info SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE integration_info SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_order_confirmations SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_orders SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE lab_results SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE milestones SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE notes SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE notifications SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE personnel_info SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE regulatory_info SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE responsibilities SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE stratus_facility_mappings SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE stratus_orders SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE trained_personnel SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  UPDATE training_info SET facility_id = target_facility_id WHERE facility_id = source_facility_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_records_moved := v_records_moved + v_count;

  DELETE FROM facilities WHERE id = source_facility_id;

  v_result := json_build_object(
    'success', true,
    'records_moved', v_records_moved,
    'source_facility_id', source_facility_id,
    'target_facility_id', target_facility_id
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION merge_facilities IS 'Merges all related records from source facility to target facility, then deletes the source facility. Only accessible to Proximity Admins.';
