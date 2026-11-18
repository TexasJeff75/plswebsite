/*
  # StratusDX auto-import: only update groups that need it

  Import All timed out from the web page (8 seconds): it ran two UPDATEs for
  every organization + location group (141), even groups whose orders were
  all assigned already. The group query now also counts unassigned orders
  (from the covering index idx_lab_orders_org_loc_fac), and the order and
  result UPDATEs run only for groups with unassigned orders. Creating
  missing organizations, facilities and mappings is unchanged, as are the
  access rules and the return shape.
*/

CREATE OR REPLACE FUNCTION import_stratus_organizations_and_facilities()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group RECORD;
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
    -- A direct database session (the Supabase SQL Editor) has no API request
    -- claims and may run it. Every call through the app's API carries claims.
    IF coalesce(current_setting('request.jwt.claims', true), '') <> '' AND NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND lower(replace(role, '_', ' ')) IN ('super admin', 'proximity admin')
    ) THEN
        RAISE EXCEPTION 'Only Super Admins and Proximity Admins can use the StratusDX auto-import';
    END IF;

    FOR v_group IN
        SELECT lo.organization_name, lo.location_name,
               count(*) FILTER (WHERE lo.facility_id IS NULL) AS unassigned
        FROM lab_orders lo
        WHERE coalesce(lo.organization_name, '') NOT IN ('', 'TEST')
          AND coalesce(lo.location_name, '') NOT IN ('', 'TEST Location')
        GROUP BY lo.organization_name, lo.location_name
        ORDER BY lo.organization_name, lo.location_name
    LOOP
        -- Organization
        SELECT id INTO v_org_id FROM organizations
        WHERE lower(trim(name)) = lower(trim(v_group.organization_name)) LIMIT 1;
        IF v_org_id IS NULL THEN
            INSERT INTO organizations (name, type) VALUES (v_group.organization_name, 'customer')
            RETURNING id INTO v_org_id;
            v_orgs_created := v_orgs_created + 1;
            v_org_action := 'created';
        ELSE
            v_orgs_existing := v_orgs_existing + 1;
            v_org_action := 'existing';
        END IF;

        -- Facility (matched by name within the organization)
        SELECT id INTO v_fac_id FROM facilities
        WHERE lower(trim(name)) = lower(trim(v_group.location_name)) AND organization_id = v_org_id LIMIT 1;
        IF v_fac_id IS NULL THEN
            INSERT INTO facilities (name, organization_id, status) VALUES (v_group.location_name, v_org_id, 'Live')
            RETURNING id INTO v_fac_id;
            v_facilities_created := v_facilities_created + 1;
            v_fac_action := 'created';
        ELSE
            v_facilities_existing := v_facilities_existing + 1;
            v_fac_action := 'existing';
        END IF;

        -- Mapping
        SELECT id INTO v_mapping_id FROM stratus_facility_mappings
        WHERE stratus_facility_identifier = v_group.location_name
          AND organization_id = v_org_id
          AND facility_id = v_fac_id
          AND is_active = true
        LIMIT 1;
        IF v_mapping_id IS NULL THEN
            INSERT INTO stratus_facility_mappings (
                organization_id, facility_id,
                stratus_facility_identifier, stratus_organization_identifier,
                mapping_type, is_active, notes
            ) VALUES (
                v_org_id, v_fac_id,
                v_group.location_name, v_group.organization_name,
                'exact', true, 'Auto-imported from Stratus data'
            );
            v_mappings_created := v_mappings_created + 1;
            v_map_action := 'created';
        ELSE
            v_map_action := 'existing';
        END IF;

        -- Orders not yet assigned to a facility (skipped when there are none,
        -- so a re-run over already-assigned groups stays fast)
        IF v_group.unassigned > 0 THEN
        UPDATE lab_orders
        SET organization_id = v_org_id, facility_id = v_fac_id
        WHERE organization_name = v_group.organization_name
          AND location_name = v_group.location_name
          AND facility_id IS NULL;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_orders_updated := v_orders_updated + v_rows;

        -- Their results
        UPDATE lab_results lr
        SET organization_id = v_org_id, facility_id = v_fac_id
        FROM lab_orders lo
        WHERE lr.lab_order_id = lo.id
          AND lo.organization_name = v_group.organization_name
          AND lo.location_name = v_group.location_name
          AND lr.facility_id IS NULL;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_results_updated := v_results_updated + v_rows;
        END IF;

        v_details := v_details || jsonb_build_array(jsonb_build_object(
            'organization', v_group.organization_name,
            'location', v_group.location_name,
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

REVOKE EXECUTE ON FUNCTION import_stratus_organizations_and_facilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION import_stratus_organizations_and_facilities() TO authenticated;
