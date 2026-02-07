/*
  # Restore Activity Log Triggers

  ## Overview
  The activity logging triggers were previously lost, causing no automatic
  activity tracking on any facility-related tables. This migration restores
  all 11 triggers that fire the `log_facility_activity()` function.

  ## Tables Getting Triggers Restored
  1. `facilities` - Facility info changes
  2. `equipment` - Equipment additions, modifications, deletions
  3. `milestones` - Milestone progress and updates
  4. `documents` - Document uploads and modifications
  5. `personnel_info` - Personnel information
  6. `trained_personnel` - Staff training records
  7. `regulatory_info` - Regulatory compliance data
  8. `integration_info` - Integration details
  9. `facility_readiness_info` - Facility readiness assessments
  10. `training_info` - Training information
  11. `interface_status` - Interface configuration status

  ## Security
  - Triggers use the existing SECURITY DEFINER function
  - Activity log RLS policies remain unchanged

  ## Important Notes
  1. All triggers are AFTER triggers so they don't block the original operation
  2. Each trigger fires on INSERT, UPDATE, and DELETE
  3. The existing `log_facility_activity()` function is reused (not recreated)
*/

DROP TRIGGER IF EXISTS facilities_activity_log_trigger ON facilities;
CREATE TRIGGER facilities_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS equipment_activity_log_trigger ON equipment;
CREATE TRIGGER equipment_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS milestones_activity_log_trigger ON milestones;
CREATE TRIGGER milestones_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON milestones
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS documents_activity_log_trigger ON documents;
CREATE TRIGGER documents_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS personnel_info_activity_log_trigger ON personnel_info;
CREATE TRIGGER personnel_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON personnel_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS trained_personnel_activity_log_trigger ON trained_personnel;
CREATE TRIGGER trained_personnel_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON trained_personnel
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS regulatory_info_activity_log_trigger ON regulatory_info;
CREATE TRIGGER regulatory_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON regulatory_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS integration_info_activity_log_trigger ON integration_info;
CREATE TRIGGER integration_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON integration_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS facility_readiness_info_activity_log_trigger ON facility_readiness_info;
CREATE TRIGGER facility_readiness_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON facility_readiness_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS training_info_activity_log_trigger ON training_info;
CREATE TRIGGER training_info_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON training_info
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();

DROP TRIGGER IF EXISTS interface_status_activity_log_trigger ON interface_status;
CREATE TRIGGER interface_status_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON interface_status
  FOR EACH ROW
  EXECUTE FUNCTION log_facility_activity();
