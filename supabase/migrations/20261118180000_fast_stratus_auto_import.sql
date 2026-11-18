/*
  # Fast StratusDX auto-import (preview and import)

  With tens of thousands of orders, get_unmapped_stratus_orgs_and_locations()
  failed (500, statement timeout): it read the full order_data JSON of every
  order to pull out address and phone details. The LIS Integration API has
  no such details (only organizationName and locationName), so those values
  were empty anyway.

  Both functions now work from the organization_name and location_name
  columns only, with an index on them:
  - The preview groups orders by organization + location and returns the
    order count and how many are not yet assigned to a facility
    (unassigned_count).
  - The import creates missing organizations, facilities and mappings, then
    assigns only orders with no facility yet, and their results through
    lab_order_id. Return shape is unchanged.

  Both were open to every signed-in user (the Settings page is also open to
  Customer Admins) and the import creates organizations and reassigns
  orders, so both now require a Super Admin or Proximity Admin role.
*/

CREATE INDEX IF NOT EXISTS idx_lab_orders_org_loc_names ON lab_orders(organization_name, location_name);
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order_id ON lab_results(lab_order_id);

CREATE OR REPLACE FUNCTION get_unmapped_stratus_orgs_and_locations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb := '[]'::jsonb;
    v_group RECORD;
    v_org_id uuid;
    v_fac_id uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND lower(replace(role, '_', ' ')) IN ('super admin', 'proximity admin')
    ) THEN
        RAISE EXCEPTION 'Only Super Admins and Proximity Admins can use the StratusDX auto-import';
    END IF;

    FOR v_group IN
        SELECT
            lo.organization_name,
            lo.location_name,
            count(*) AS order_count,
            count(*) FILTER (WHERE lo.facility_id IS NULL) AS unassigned_count
        FROM lab_orders lo
        WHERE coalesce(lo.organization_name, '') NOT IN ('', 'TEST')
          AND coalesce(lo.location_name, '') NOT IN ('', 'TEST Location')
        GROUP BY lo.organization_name, lo.location_name
        ORDER BY count(*) DESC
    LOOP
        v_fac_id := NULL;
        SELECT id INTO v_org_id FROM organizations
        WHERE lower(trim(name)) = lower(trim(v_group.organization_name)) LIMIT 1;
        IF v_org_id IS NOT NULL THEN
            SELECT id INTO v_fac_id FROM facilities
            WHERE lower(trim(name)) = lower(trim(v_group.location_name)) AND organization_id = v_org_id LIMIT 1;
        END IF;

        v_result := v_result || jsonb_build_array(jsonb_build_object(
            'organization_name', v_group.organization_name,
            'location_name', v_group.location_name,
            'order_count', v_group.order_count,
            'unassigned_count', v_group.unassigned_count,
            'org_exists', v_org_id IS NOT NULL,
            'facility_exists', v_fac_id IS NOT NULL,
            'is_mapped', v_fac_id IS NOT NULL
        ));
    END LOOP;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unmapped_stratus_orgs_and_locations() TO authenticated;

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
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND lower(replace(role, '_', ' ')) IN ('super admin', 'proximity admin')
    ) THEN
        RAISE EXCEPTION 'Only Super Admins and Proximity Admins can use the StratusDX auto-import';
    END IF;

    FOR v_group IN
        SELECT lo.organization_name, lo.location_name
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

        -- Orders not yet assigned to a facility
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

GRANT EXECUTE ON FUNCTION import_stratus_organizations_and_facilities() TO authenticated;
