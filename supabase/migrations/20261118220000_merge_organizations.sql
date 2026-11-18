/*
  # merge_organizations(source, target)

  Merges a duplicate organization into the one to keep, then deletes the
  duplicate. Many tables delete their rows when an organization is deleted
  (ON DELETE CASCADE, lab_orders included), so everything is moved first:

  1. Every column with a foreign key to organizations(id), found from the
     database catalog (so no table is missed), is pointed at the target.
     A row that would duplicate a row the target already has (a unique
     constraint, e.g. the same user linked to both) is dropped instead.
  2. Facilities that now share a name within the target are merged the same
     way: every foreign key to facilities(id) is moved to the facility kept
     (the one with the most lab orders), then the extra facility is deleted.
  3. The source organization is deleted once nothing refers to it.

  It all runs in one transaction: any error undoes everything.

  Who can run it: a direct database session (the Supabase SQL Editor), or a
  Super Admin or Proximity Admin through the app.

    select merge_organizations('<duplicate id>', '<id to keep>');
*/

-- Points every foreign key that refers to <ref_table>(id) = from_id at to_id.
-- Rows that would break a unique constraint are deleted (the target already
-- has an equivalent row). Returns {table.column: {moved, dropped}}.
CREATE OR REPLACE FUNCTION repoint_references(ref_table regclass, from_id uuid, to_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    fk RECORD;
    r RECORD;
    v_moved int;
    v_dropped int;
    v_report jsonb := '{}'::jsonb;
BEGIN
    FOR fk IN
        SELECT c.conrelid::regclass AS tbl, a.attname AS col
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f'
          AND c.confrelid = ref_table
          AND array_length(c.conkey, 1) = 1
    LOOP
        v_moved := 0;
        v_dropped := 0;
        BEGIN
            EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', fk.tbl, fk.col, fk.col) USING to_id, from_id;
            GET DIAGNOSTICS v_moved = ROW_COUNT;
        EXCEPTION WHEN unique_violation THEN
            -- Row by row: move what can move, drop what duplicates the target.
            FOR r IN EXECUTE format('SELECT ctid FROM %s WHERE %I = $1', fk.tbl, fk.col) USING from_id LOOP
                BEGIN
                    EXECUTE format('UPDATE %s SET %I = $1 WHERE ctid = $2', fk.tbl, fk.col) USING to_id, r.ctid;
                    v_moved := v_moved + 1;
                EXCEPTION WHEN unique_violation THEN
                    EXECUTE format('DELETE FROM %s WHERE ctid = $1', fk.tbl) USING r.ctid;
                    v_dropped := v_dropped + 1;
                END;
            END LOOP;
        END;
        IF v_moved + v_dropped > 0 THEN
            v_report := v_report || jsonb_build_object(format('%s.%s', fk.tbl, fk.col),
                jsonb_build_object('moved', v_moved, 'dropped', v_dropped));
        END IF;
    END LOOP;
    RETURN v_report;
END;
$$;

REVOKE EXECUTE ON FUNCTION repoint_references(regclass, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION merge_organizations(source_org_id uuid, target_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_source_name text;
    v_target_name text;
    v_org_moves jsonb;
    v_facility_merges jsonb := '[]'::jsonb;
    v_dup RECORD;
    v_keep uuid;
    v_extra uuid;
BEGIN
    -- A direct database session (no API claims) or an admin through the app.
    IF coalesce(current_setting('request.jwt.claims', true), '') <> '' AND NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND lower(replace(role, '_', ' ')) IN ('super admin', 'proximity admin')
    ) THEN
        RAISE EXCEPTION 'Only Super Admins and Proximity Admins can merge organizations';
    END IF;

    IF source_org_id = target_org_id THEN
        RAISE EXCEPTION 'The organization to remove and the one to keep must be different';
    END IF;
    SELECT name INTO v_source_name FROM organizations WHERE id = source_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Organization to remove not found: %', source_org_id; END IF;
    SELECT name INTO v_target_name FROM organizations WHERE id = target_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Organization to keep not found: %', target_org_id; END IF;

    -- 1. Everything that points at the duplicate now points at the one kept.
    v_org_moves := repoint_references('organizations'::regclass, source_org_id, target_org_id);

    -- 2. Facilities with the same name under the kept organization become one.
    FOR v_dup IN
        SELECT lower(trim(name)) AS key
        FROM facilities
        WHERE organization_id = target_org_id
        GROUP BY lower(trim(name))
        HAVING count(*) > 1
    LOOP
        SELECT f.id INTO v_keep
        FROM facilities f
        WHERE f.organization_id = target_org_id AND lower(trim(f.name)) = v_dup.key
        ORDER BY (SELECT count(*) FROM lab_orders lo WHERE lo.facility_id = f.id) DESC, f.created_at NULLS LAST
        LIMIT 1;

        FOR v_extra IN
            SELECT f.id FROM facilities f
            WHERE f.organization_id = target_org_id AND lower(trim(f.name)) = v_dup.key AND f.id <> v_keep
        LOOP
            v_facility_merges := v_facility_merges || jsonb_build_array(jsonb_build_object(
                'facility', v_dup.key,
                'kept', v_keep,
                'removed', v_extra,
                'moved', repoint_references('facilities'::regclass, v_extra, v_keep)
            ));
            DELETE FROM facilities WHERE id = v_extra;
        END LOOP;
    END LOOP;

    -- 3. Remove the duplicate organization.
    DELETE FROM organizations WHERE id = source_org_id;

    RETURN jsonb_build_object(
        'removed', jsonb_build_object('id', source_org_id, 'name', v_source_name),
        'kept', jsonb_build_object('id', target_org_id, 'name', v_target_name),
        'moved', v_org_moves,
        'facilities_merged', v_facility_merges
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION merge_organizations(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION merge_organizations(uuid, uuid) TO authenticated;
