/*
  # Covering index for the StratusDX auto-import preview

  After the 55,000-order catch-up, get_unmapped_stratus_orgs_and_locations()
  still hit the web request's 8-second limit: grouping read every (wide,
  often rewritten) lab_orders row. With facility_id included in the index,
  the grouping is answered from the index alone (index-only scan): 0.7
  seconds on the live table after VACUUM ANALYZE.

  Already created by hand in the SQL Editor on 2026-11-18; IF NOT EXISTS
  makes this a no-op there.
*/

CREATE INDEX IF NOT EXISTS idx_lab_orders_org_loc_fac
  ON lab_orders (organization_name, location_name) INCLUDE (facility_id);
