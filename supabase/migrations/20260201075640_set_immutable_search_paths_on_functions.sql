/*
  # Set Immutable Search Paths on Security Definer Functions

  ## Overview
  Sets explicit search_path on all SECURITY DEFINER functions to prevent search_path manipulation attacks.
  Without explicit search_path, malicious users could create objects in schemas that get searched
  before the intended schema, potentially hijacking function behavior.

  ## Changes Made

  Sets `SET search_path = pg_catalog, public` on all SECURITY DEFINER functions.
  Many functions have multiple overloaded versions which are all updated.

  ### Functions Updated
  1. is_internal_user (2 versions)
  2. user_can_access_organization (2 versions)
  3. user_can_access_facility (2 versions)
  4. get_user_org_role (2 versions)
  5. is_admin_user (2 versions)
  6. is_admin_or_manager (2 versions)
  7. get_user_organization_ids (2 versions)
  8. log_facility_activity (1 version)
  9. sync_template_equipment_to_facilities (1 version)
  10. calculate_facility_stats (1 version)
  11. trigger_update_facility_stats (1 version)
  12. trigger_update_facility_stats_on_facility_change (1 version)

  ## Security Impact
  - Prevents schema injection attacks
  - Ensures functions always reference correct database objects
  - Required security best practice for SECURITY DEFINER functions
*/

-- User access and role check functions (with no arguments)
ALTER FUNCTION is_internal_user() SET search_path = pg_catalog, public;
ALTER FUNCTION is_admin_user() SET search_path = pg_catalog, public;
ALTER FUNCTION is_admin_or_manager() SET search_path = pg_catalog, public;
ALTER FUNCTION get_user_organization_ids() SET search_path = pg_catalog, public;

-- User access and role check functions (with arguments)
ALTER FUNCTION is_internal_user(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION user_can_access_organization(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION user_can_access_organization(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION user_can_access_facility(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION user_can_access_facility(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION get_user_org_role(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION get_user_org_role(uuid, uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION is_admin_user(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION is_admin_or_manager(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION get_user_organization_ids(uuid) SET search_path = pg_catalog, public;

-- Activity logging function
ALTER FUNCTION log_facility_activity() SET search_path = pg_catalog, public;

-- Template synchronization function
ALTER FUNCTION sync_template_equipment_to_facilities(uuid) SET search_path = pg_catalog, public;

-- Facility statistics calculation functions
ALTER FUNCTION calculate_facility_stats(uuid) SET search_path = pg_catalog, public;
ALTER FUNCTION trigger_update_facility_stats() SET search_path = pg_catalog, public;
ALTER FUNCTION trigger_update_facility_stats_on_facility_change() SET search_path = pg_catalog, public;
