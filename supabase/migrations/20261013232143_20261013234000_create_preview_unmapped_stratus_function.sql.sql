/*
  # Create Function to Preview Unmapped Stratus Organizations and Locations

  ## Overview
  Returns a list of unique organization + location combos found in lab_orders
  that are NOT yet mapped to an organization/facility. Used by the UI to show
  a preview before the user clicks "Import".

  ## Function: get_unmapped_stratus_orgs_and_locations()
  Returns array of: { organization_name, org_code, org_clia, org_phone, org_address, org_city, org_state, org_zip, org_medical_director, location_name, loc_code, loc_phone, loc_fax, loc_address, loc_city, loc_state, loc_zip, order_count, is_mapped }
*/

CREATE OR REPLACE FUNCTION get_unmapped_stratus_orgs_and_locations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb := '[]'::jsonb;
    v_row jsonb;
    v_org_id uuid;
    v_fac_id uuid;
BEGIN
    FOR v_row IN
        SELECT jsonb_build_object(
            'organization_name', org_name,
            'org_code', org_code,
            'org_clia', org_clia,
            'org_phone', org_phone,
            'org_address', org_address,
            'org_city', org_city,
            'org_state', org_state,
            'org_zip', org_zip,
            'org_medical_director', org_med_dir,
            'location_name', loc_name,
            'loc_code', loc_code,
            'loc_phone', loc_phone,
            'loc_fax', loc_fax,
            'loc_address', loc_address,
            'loc_city', loc_city,
            'loc_state', loc_state,
            'loc_zip', loc_zip,
            'order_count', order_count,
            'is_mapped', false
        )
        FROM (
            SELECT DISTINCT
                lo.organization_name AS org_name,
                lo.order_data->'organization'->>'code' AS org_code,
                lo.order_data->'organization'->>'clia' AS org_clia,
                lo.order_data->'organization'->>'phone' AS org_phone,
                lo.order_data->'organization'->>'address_street' AS org_address,
                lo.order_data->'organization'->>'address_city' AS org_city,
                lo.order_data->'organization'->>'address_state_code' AS org_state,
                lo.order_data->'organization'->>'address_zip' AS org_zip,
                lo.order_data->'organization'->>'medical_director' AS org_med_dir,
                lo.location_name AS loc_name,
                lo.order_data->'location'->>'code' AS loc_code,
                lo.order_data->'location'->>'phone' AS loc_phone,
                lo.order_data->'location'->>'fax' AS loc_fax,
                lo.order_data->'location'->>'address_street' AS loc_address,
                lo.order_data->'location'->>'address_city' AS loc_city,
                lo.order_data->'location'->>'address_state_code' AS loc_state,
                lo.order_data->'location'->>'address_zip' AS loc_zip,
                count(*) AS order_count
            FROM lab_orders lo
            WHERE lo.organization_name IS NOT NULL
              AND lo.organization_name != ''
              AND lo.organization_name != 'TEST'
              AND lo.location_name IS NOT NULL
              AND lo.location_name != ''
              AND lo.location_name != 'TEST Location'
            GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18
            ORDER BY order_count DESC
        ) summary
    LOOP
        -- Check if org exists
        SELECT id INTO v_org_id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_row->>'organization_name')) LIMIT 1;

        IF v_org_id IS NOT NULL THEN
            v_row := jsonb_set(v_row, '{org_exists}', 'true');
            -- Check if facility exists
            SELECT id INTO v_fac_id FROM facilities WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_row->>'location_name')) AND organization_id = v_org_id LIMIT 1;
            v_row := jsonb_set(v_row, '{facility_exists}', COALESCE(v_fac_id IS NOT NULL, false)::text::jsonb);
            v_row := jsonb_set(v_row, '{is_mapped}', COALESCE(v_fac_id IS NOT NULL, false)::text::jsonb);
        ELSE
            v_row := jsonb_set(v_row, '{org_exists}', 'false');
            v_row := jsonb_set(v_row, '{facility_exists}', 'false');
            v_row := jsonb_set(v_row, '{is_mapped}', 'false');
        END IF;

        v_result := v_result || jsonb_build_array(v_row);
    END LOOP;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unmapped_stratus_orgs_and_locations() TO authenticated;
