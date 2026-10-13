/*
  # Create Function to Auto-Import Organizations and Facilities from Stratus Data

  ## Overview
  Creates a SECURITY DEFINER function that scans all lab_orders for unique
  organization and location data, creates missing organizations and facilities,
  and creates stratus_facility_mappings to link them. Returns a summary of
  what was created vs. what already existed.

  ## Function: import_stratus_organizations_and_facilities()
  - Scans lab_orders for unique organization_name + location_name combos
  - Creates organizations where none exists (matched by name)
  - Creates facilities where none exists (matched by name + organization)
  - Creates stratus_facility_mappings linking them
  - Updates lab_orders and lab_results with the org/facility IDs
  - Returns JSON summary: { orgs_created, orgs_existing, facilities_created, facilities_existing, mappings_created, orders_updated, results_updated, details: [] }
*/

CREATE OR REPLACE FUNCTION import_stratus_organizations_and_facilities()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb := jsonb_build_object(
        'orgs_created', 0,
        'orgs_existing', 0,
        'facilities_created', 0,
        'facilities_existing', 0,
        'mappings_created', 0,
        'orders_updated', 0,
        'results_updated', 0,
        'details', '[]'::jsonb
    );
    v_org RECORD;
    v_org_id uuid;
    v_fac_id uuid;
    v_mapping_id uuid;
    v_detail jsonb;
    v_org_clia text;
    v_org_phone text;
    v_org_addr text;
    v_org_city text;
    v_org_state text;
    v_org_zip text;
    v_org_med_dir text;
    v_loc_code text;
    v_loc_phone text;
    v_loc_fax text;
    v_loc_addr text;
    v_loc_city text;
    v_loc_state text;
    v_loc_zip text;
BEGIN
    FOR v_org IN
        SELECT DISTINCT
            lo.organization_name,
            lo.location_name,
            lo.order_data->'organization'->>'code' AS org_code,
            lo.order_data->'organization'->>'clia' AS org_clia,
            lo.order_data->'organization'->>'phone' AS org_phone,
            lo.order_data->'organization'->>'address_street' AS org_address,
            lo.order_data->'organization'->>'address_city' AS org_city,
            lo.order_data->'organization'->>'address_state_code' AS org_state,
            lo.order_data->'organization'->>'address_zip' AS org_zip,
            lo.order_data->'organization'->>'medical_director' AS org_med_dir,
            lo.order_data->'location'->>'code' AS loc_code,
            lo.order_data->'location'->>'phone' AS loc_phone,
            lo.order_data->'location'->>'fax' AS loc_fax,
            lo.order_data->'location'->>'address_street' AS loc_address,
            lo.order_data->'location'->>'address_city' AS loc_city,
            lo.order_data->'location'->>'address_state_code' AS loc_state,
            lo.order_data->'location'->>'address_zip' AS loc_zip
        FROM lab_orders lo
        WHERE lo.organization_name IS NOT NULL
          AND lo.organization_name != ''
          AND lo.organization_name != 'TEST'
          AND lo.location_name IS NOT NULL
          AND lo.location_name != ''
          AND lo.location_name != 'TEST Location'
    LOOP
        v_detail := jsonb_build_object('organization', v_org.organization_name, 'location', v_org.location_name);

        -- Find or create organization
        SELECT id INTO v_org_id FROM organizations WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_org.organization_name)) LIMIT 1;

        IF v_org_id IS NULL THEN
            INSERT INTO organizations (name, type, contact_phone, address, city, state, zip)
            VALUES (
                v_org.organization_name,
                'customer',
                NULLIF(v_org.org_phone, ''),
                NULLIF(v_org.org_address, ''),
                NULLIF(v_org.org_city, ''),
                NULLIF(v_org.org_state, ''),
                NULLIF(v_org.org_zip, '')
            )
            RETURNING id INTO v_org_id;

            v_result := jsonb_set(v_result, '{orgs_created}', (v_result->>'orgs_created')::int + 1);
            v_detail := jsonb_set(v_detail, '{org_action}', 'created');
        ELSE
            v_result := jsonb_set(v_result, '{orgs_existing}', (v_result->>'orgs_existing')::int + 1);
            v_detail := jsonb_set(v_detail, '{org_action}', 'existing');
        END IF;

        -- Find or create facility (matched by name + org)
        SELECT id INTO v_fac_id FROM facilities WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_org.location_name)) AND organization_id = v_org_id LIMIT 1;

        IF v_fac_id IS NULL THEN
            INSERT INTO facilities (name, organization_id, address, city, state, zip, phone, status)
            VALUES (
                v_org.location_name,
                v_org_id,
                NULLIF(v_org.loc_addr, ''),
                NULLIF(v_org.loc_city, ''),
                NULLIF(v_org.loc_state, ''),
                NULLIF(v_org.loc_zip, ''),
                NULLIF(v_org.loc_phone, ''),
                'Active'
            )
            RETURNING id INTO v_fac_id;

            v_result := jsonb_set(v_result, '{facilities_created}', (v_result->>'facilities_created')::int + 1);
            v_detail := jsonb_set(v_detail, '{facility_action}', 'created');
        ELSE
            v_result := jsonb_set(v_result, '{facilities_existing}', (v_result->>'facilities_existing')::int + 1);
            v_detail := jsonb_set(v_detail, '{facility_action}', 'existing');
        END IF;

        -- Create mapping if not exists
        SELECT id INTO v_mapping_id FROM stratus_facility_mappings
        WHERE stratus_facility_identifier = v_org.location_name
          AND organization_id = v_org_id
          AND facility_id = v_fac_id
          AND is_active = true
        LIMIT 1;

        IF v_mapping_id IS NULL THEN
            INSERT INTO stratus_facility_mappings (
                organization_id, facility_id,
                stratus_facility_identifier, stratus_organization_identifier,
                mapping_type, is_active
            )
            VALUES (
                v_org_id, v_fac_id,
                v_org.location_name, v_org.organization_name,
                'auto_import', true
            )
            RETURNING id INTO v_mapping_id;

            v_result := jsonb_set(v_result, '{mappings_created}', (v_result->>'mappings_created')::int + 1);
            v_detail := jsonb_set(v_detail, '{mapping_action}', 'created');
        ELSE
            v_detail := jsonb_set(v_detail, '{mapping_action}', 'existing');
        END IF;

        -- Update lab_orders with org and facility IDs
        UPDATE lab_orders
        SET organization_id = v_org_id, facility_id = v_fac_id
        WHERE organization_name = v_org.organization_name
          AND location_name = v_org.location_name
          AND (organization_id IS NULL OR facility_id IS NULL);

        GET DIAGNOSTICS v_org_clia = ROW_COUNT;
        v_result := jsonb_set(v_result, '{orders_updated}', (v_result->>'orders_updated')::int + v_org_clia::int);

        -- Update lab_results too
        UPDATE lab_results
        SET organization_id = v_org_id, facility_id = v_fac_id
        WHERE stratus_guid IN (
            SELECT lr.stratus_guid FROM lab_results lr
            JOIN lab_orders lo ON lo.accession_number = lr.accession_number
            WHERE lo.organization_name = v_org.organization_name
              AND lo.location_name = v_org.location_name
              AND (lr.organization_id IS NULL OR lr.facility_id IS NULL)
        );

        GET DIAGNOSTICS v_org_phone = ROW_COUNT;
        v_result := jsonb_set(v_result, '{results_updated}', (v_result->>'results_updated')::int + v_org_phone::int);

        v_detail := jsonb_set(v_detail, '{org_id}', v_org_id::text);
        v_detail := jsonb_set(v_detail, '{facility_id}', v_fac_id::text);

        v_result := jsonb_set(v_result, '{details}', (v_result->'details') || jsonb_build_array(v_detail));
    END LOOP;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION import_stratus_organizations_and_facilities() TO authenticated;
