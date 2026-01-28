/*
  # Add Missing Foreign Key Indexes

  This migration adds indexes to foreign key columns that were missing indexes,
  which improves query performance when joining tables.

  ## Foreign Keys Being Indexed:
  1. compliance_events.created_by_fkey
  2. deployment_templates.created_by_fkey
  3. documents.uploaded_by_fkey
  4. facilities.created_by_fkey
  5. facilities.updated_by_fkey
  6. interface_status.integration_info_id_fkey
  7. notes.created_by_fkey
  8. notifications.facility_id_fkey
  9. notifications.organization_id_fkey
  10. reference_data.created_by_fkey
  11. reference_data_audit.changed_by_fkey
  12. responsibilities.user_id_fkey
  13. trained_personnel.facility_id_fkey
  14. user_organization_assignments.assigned_by_fkey
*/

-- compliance_events.created_by
CREATE INDEX IF NOT EXISTS idx_compliance_events_created_by 
  ON compliance_events(created_by);

-- deployment_templates.created_by
CREATE INDEX IF NOT EXISTS idx_deployment_templates_created_by 
  ON deployment_templates(created_by);

-- documents.uploaded_by
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by 
  ON documents(uploaded_by);

-- facilities.created_by
CREATE INDEX IF NOT EXISTS idx_facilities_created_by 
  ON facilities(created_by);

-- facilities.updated_by
CREATE INDEX IF NOT EXISTS idx_facilities_updated_by 
  ON facilities(updated_by);

-- interface_status.integration_info_id
CREATE INDEX IF NOT EXISTS idx_interface_status_integration_info_id 
  ON interface_status(integration_info_id);

-- notes.created_by
CREATE INDEX IF NOT EXISTS idx_notes_created_by 
  ON notes(created_by);

-- notifications.facility_id
CREATE INDEX IF NOT EXISTS idx_notifications_facility_id 
  ON notifications(facility_id);

-- notifications.organization_id
CREATE INDEX IF NOT EXISTS idx_notifications_organization_id 
  ON notifications(organization_id);

-- reference_data.created_by
CREATE INDEX IF NOT EXISTS idx_reference_data_created_by 
  ON reference_data(created_by);

-- reference_data_audit.changed_by
CREATE INDEX IF NOT EXISTS idx_reference_data_audit_changed_by 
  ON reference_data_audit(changed_by);

-- responsibilities.user_id
CREATE INDEX IF NOT EXISTS idx_responsibilities_user_id 
  ON responsibilities(user_id);

-- trained_personnel.facility_id
CREATE INDEX IF NOT EXISTS idx_trained_personnel_facility_id 
  ON trained_personnel(facility_id);

-- user_organization_assignments.assigned_by
CREATE INDEX IF NOT EXISTS idx_user_org_assignments_assigned_by 
  ON user_organization_assignments(assigned_by);
