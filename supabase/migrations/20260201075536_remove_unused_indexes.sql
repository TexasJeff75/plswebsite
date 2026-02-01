/*
  # Remove Unused Indexes

  ## Overview
  Removes unused indexes to improve write performance and reduce storage overhead.
  All indexes listed here have been identified by Supabase as unused in production.

  ## Changes Made
  
  Drops 93 unused indexes across multiple tables:
  - Organizations table - 6 indexes
  - Facilities table - 11 indexes
  - Equipment-related tables - 7 indexes
  - Template tables - 7 indexes
  - Support system tables - 7 indexes
  - Compliance tables - 7 indexes
  - Activity/audit tables - 8 indexes
  - Notifications table - 4 indexes
  - Reference data tables - 5 indexes
  - Document tables - 3 indexes
  - User/role tables - 3 indexes
  - Deployment tables - 4 indexes
  - Regulatory tables - 3 indexes
  - Personnel tables - 1 index
  - Site-specific tables - 5 indexes
  - Milestone tables - 2 indexes
  - Deficiencies table - 5 indexes
  - Test catalog tables - 4 indexes

  ## Performance Impact
  - Improves INSERT/UPDATE/DELETE performance
  - Reduces storage overhead
  - Simplifies query planning
  - Indexes can be recreated if usage patterns change
*/

-- Organizations table
DROP INDEX IF EXISTS idx_organizations_mrr;
DROP INDEX IF EXISTS idx_organizations_billing;
DROP INDEX IF EXISTS idx_organizations_client_type;
DROP INDEX IF EXISTS idx_organizations_region;
DROP INDEX IF EXISTS idx_organizations_contract_status;
DROP INDEX IF EXISTS idx_organizations_default_template;

-- Facilities table
DROP INDEX IF EXISTS idx_facilities_created_by;
DROP INDEX IF EXISTS idx_facilities_updated_by;
DROP INDEX IF EXISTS idx_facilities_state;
DROP INDEX IF EXISTS idx_facilities_region;
DROP INDEX IF EXISTS idx_facilities_phase;
DROP INDEX IF EXISTS idx_facilities_city;
DROP INDEX IF EXISTS idx_facilities_coordinates;
DROP INDEX IF EXISTS idx_facilities_site_type;
DROP INDEX IF EXISTS idx_facilities_facility_type;
DROP INDEX IF EXISTS idx_facilities_testing_complexity;
DROP INDEX IF EXISTS idx_facilities_deployment_template;

-- Equipment tables
DROP INDEX IF EXISTS idx_equipment_from_template;
DROP INDEX IF EXISTS idx_equipment_catalog_documents_active;
DROP INDEX IF EXISTS idx_equipment_catalog_documents_type;
DROP INDEX IF EXISTS idx_equipment_catalog_org_id;
DROP INDEX IF EXISTS idx_equipment_catalog_type;
DROP INDEX IF EXISTS idx_equipment_catalog_system;
DROP INDEX IF EXISTS idx_site_equipment_catalog_id;
DROP INDEX IF EXISTS idx_site_equipment_status;

-- Template tables
DROP INDEX IF EXISTS idx_template_equipment_template_id;
DROP INDEX IF EXISTS idx_template_equipment_catalog_id;
DROP INDEX IF EXISTS idx_deployment_templates_org_id;
DROP INDEX IF EXISTS idx_deployment_templates_type;
DROP INDEX IF EXISTS idx_deployment_templates_system;
DROP INDEX IF EXISTS idx_deployment_templates_created_by;
DROP INDEX IF EXISTS idx_template_milestones_deployment_id;
DROP INDEX IF EXISTS idx_template_milestones_milestone_id;
DROP INDEX IF EXISTS idx_template_milestones_priority;

-- Milestone templates
DROP INDEX IF EXISTS idx_milestone_templates_org_id;
DROP INDEX IF EXISTS idx_milestone_templates_category;
DROP INDEX IF EXISTS idx_milestone_templates_phase;
DROP INDEX IF EXISTS idx_milestone_templates_system;
DROP INDEX IF EXISTS idx_milestone_templates_priority;

-- Milestones table
DROP INDEX IF EXISTS idx_milestones_priority;

-- Support tickets
DROP INDEX IF EXISTS idx_support_tickets_status;
DROP INDEX IF EXISTS idx_support_tickets_priority;
DROP INDEX IF EXISTS idx_support_tickets_category;
DROP INDEX IF EXISTS idx_support_tickets_assigned_to;
DROP INDEX IF EXISTS idx_support_tickets_created_by;
DROP INDEX IF EXISTS idx_support_tickets_sla_deadline;

-- Ticket messages
DROP INDEX IF EXISTS idx_ticket_messages_user_id;
DROP INDEX IF EXISTS idx_ticket_messages_created_at;

-- Compliance tables
DROP INDEX IF EXISTS idx_compliance_events_event_type;
DROP INDEX IF EXISTS idx_compliance_events_event_date;
DROP INDEX IF EXISTS idx_compliance_events_status;
DROP INDEX IF EXISTS idx_compliance_events_created_by;

-- Deficiencies
DROP INDEX IF EXISTS idx_deficiencies_severity;
DROP INDEX IF EXISTS idx_deficiencies_status;
DROP INDEX IF EXISTS idx_deficiencies_assigned_to;
DROP INDEX IF EXISTS idx_deficiencies_due_date;
DROP INDEX IF EXISTS idx_deficiencies_opened_date;

-- Notifications
DROP INDEX IF EXISTS idx_notifications_type;
DROP INDEX IF EXISTS idx_notifications_read;
DROP INDEX IF EXISTS idx_notifications_created_at;
DROP INDEX IF EXISTS idx_notifications_organization_id;

-- Activity log
DROP INDEX IF EXISTS idx_activity_log_timestamp;
DROP INDEX IF EXISTS idx_activity_log_user_id;
DROP INDEX IF EXISTS idx_activity_log_organization_id;
DROP INDEX IF EXISTS idx_activity_log_table_name;
DROP INDEX IF EXISTS idx_activity_log_record_id;

-- Reference data
DROP INDEX IF EXISTS idx_reference_data_active;
DROP INDEX IF EXISTS idx_reference_data_code;
DROP INDEX IF EXISTS idx_reference_data_created_by;
DROP INDEX IF EXISTS idx_reference_data_audit_ref_id;
DROP INDEX IF EXISTS idx_reference_data_audit_changed_at;
DROP INDEX IF EXISTS idx_reference_data_audit_changed_by;

-- User organization assignments
DROP INDEX IF EXISTS idx_user_org_assignments_user;
DROP INDEX IF EXISTS idx_user_org_assignments_primary;
DROP INDEX IF EXISTS idx_user_org_assignments_assigned_by;

-- User roles
DROP INDEX IF EXISTS idx_user_roles_organization_id;

-- Documents
DROP INDEX IF EXISTS idx_documents_uploaded_by;
DROP INDEX IF EXISTS idx_unified_documents_type;
DROP INDEX IF EXISTS idx_unified_documents_uploader;
DROP INDEX IF EXISTS idx_unified_documents_tags;
DROP INDEX IF EXISTS idx_unified_documents_replaces;
DROP INDEX IF EXISTS idx_unified_documents_replaced_by;

-- Notes
DROP INDEX IF EXISTS idx_notes_created_by;

-- Deployments
DROP INDEX IF EXISTS idx_deployments_status;
DROP INDEX IF EXISTS idx_deployments_environment;
DROP INDEX IF EXISTS idx_deployments_date;
DROP INDEX IF EXISTS idx_deployments_project;

-- Regulatory info
DROP INDEX IF EXISTS idx_regulatory_info_accreditation_expiration;
DROP INDEX IF EXISTS idx_regulatory_info_state_license_expiration;
DROP INDEX IF EXISTS idx_regulatory_info_next_survey_due;

-- Responsibilities
DROP INDEX IF EXISTS idx_responsibilities_user_id;

-- Test catalog
DROP INDEX IF EXISTS idx_test_catalog_category;
DROP INDEX IF EXISTS idx_test_catalog_complexity;
DROP INDEX IF EXISTS idx_test_catalog_cpt_code;
DROP INDEX IF EXISTS idx_site_test_menu_test_id;
DROP INDEX IF EXISTS idx_site_test_menu_active;

-- Interface status
DROP INDEX IF EXISTS idx_interface_status_integration_info_id;
