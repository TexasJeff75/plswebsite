/*
  # Fix import_stratus_organizations_and_facilities()

  The original function failed at runtime for several reasons:
  - jsonb_set() was given int, text and uuid values instead of jsonb
    ("function jsonb_set(jsonb, unknown, integer) does not exist")
  - It read v_org.loc_addr, but the column alias is loc_address
  - It inserted mapping_type 'auto_import', which violates the
    stratus_facility_mappings mapping_type CHECK constraint
  - It inserted facility status 'Active', which violates
    facilities_status_check

  Counters are now kept in integer variables and the summary is built once
  at the end. Each organization + location pair is processed once
  (DISTINCT ON), so counts are not inflated when the same pair appears with
  slightly different address/phone details across orders.
*/

CREATE OR REPLACE FUNCTION import_stratus_organizations_and_facilities()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org RECORD;
    v_org_id uuid;
    v_fac_id uuid;
    v_mapping_id uuid;
    v_org_action text;
    v_fac_action text;
    v_map_action text;
    v_rows int;
    v_orgs_created int := 0;
    v_orgs_existing int := 0;
    v_facilities_created int := 0;
    v_facilities_existing int := 0;
    v_mappings_created int := 0;
    v_orders_updated int := 0;
    v_results_updated int := 0;
    v_details jsonb := '[]'::jsonb;
BEGIN
    FOR v_org IN
        SELECT DISTINCT ON (lo.organization_name, lo.location_name)
            lo.organization_name,
            lo.location_name,
            lo.order_data->'organization'->>'phone' AS org_phone,
            lo.order_data->'organization'->>'address_street' AS org_address,
            lo.order_data->'organization'->>'address_city' AS org_city,
            lo.order_data->'organization'->>'address_state_code' AS org_state,
            lo.order_data->'organization'->>'address_zip' AS org_zip,
            lo.order_data->'location'->>'phone' AS loc_phone,
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
        ORDER BY lo.organization_name, lo.location_name
    LOOP
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

            v_orgs_created := v_orgs_created + 1;
            v_org_action := 'created';
        ELSE
            v_orgs_existing := v_orgs_existing + 1;
            v_org_action := 'existing';
        END IF;

        -- Find or create facility (matched by name + org)
        SELECT id INTO v_fac_id FROM facilities WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_org.location_name)) AND organization_id = v_org_id LIMIT 1;

        IF v_fac_id IS NULL THEN
            INSERT INTO facilities (name, organization_id, address, city, state, zip, phone, status)
            VALUES (
                v_org.location_name,
                v_org_id,
                NULLIF(v_org.loc_address, ''),
                NULLIF(v_org.loc_city, ''),
                NULLIF(v_org.loc_state, ''),
                NULLIF(v_org.loc_zip, ''),
                NULLIF(v_org.loc_phone, ''),
                'Live'
            )
            RETURNING id INTO v_fac_id;

            v_facilities_created := v_facilities_created + 1;
            v_fac_action := 'created';
        ELSE
            v_facilities_existing := v_facilities_existing + 1;
            v_fac_action := 'existing';
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
                mapping_type, is_active, notes
            )
            VALUES (
                v_org_id, v_fac_id,
                v_org.location_name, v_org.organization_name,
                'exact', true, 'Auto-imported from Stratus data'
            );

            v_mappings_created := v_mappings_created + 1;
            v_map_action := 'created';
        ELSE
            v_map_action := 'existing';
        END IF;

        -- Update lab_orders with org and facility IDs
        UPDATE lab_orders
        SET organization_id = v_org_id, facility_id = v_fac_id
        WHERE organization_name = v_org.organization_name
          AND location_name = v_org.location_name
          AND (organization_id IS NULL OR facility_id IS NULL);

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_orders_updated := v_orders_updated + v_rows;

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

        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_results_updated := v_results_updated + v_rows;

        v_details := v_details || jsonb_build_array(jsonb_build_object(
            'organization', v_org.organization_name,
            'location', v_org.location_name,
            'org_action', v_org_action,
            'facility_action', v_fac_action,
            'mapping_action', v_map_action,
            'org_id', v_org_id,
            'facility_id', v_fac_id
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'orgs_created', v_orgs_created,
        'orgs_existing', v_orgs_existing,
        'facilities_created', v_facilities_created,
        'facilities_existing', v_facilities_existing,
        'mappings_created', v_mappings_created,
        'orders_updated', v_orders_updated,
        'results_updated', v_results_updated,
        'details', v_details
    );
END;
$$;

GRANT EXECUTE ON FUNCTION import_stratus_organizations_and_facilities() TO authenticated;
