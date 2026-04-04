
/*
  # Remove Redundant Super Admin Policies

  ## Summary
  The Super Admin user has `is_internal = true` in user_roles, which means
  `is_internal_user()` already returns true for them. All existing table policies
  already grant full access to internal users via `is_internal_user()`.

  The separate "Super Admin *" policies are therefore completely redundant and
  cause the "Multiple Permissive Policies" security warning. This migration
  drops all of them, relying on `is_internal_user()` to cover Super Admin access.

  The `is_super_admin()` and related RLS bypass functions remain available for
  use in other contexts (e.g. merge functions).
*/

-- activity_log
DROP POLICY IF EXISTS "Super Admin full access" ON activity_log;
DROP POLICY IF EXISTS "Super Admin insert" ON activity_log;
DROP POLICY IF EXISTS "Super Admin update" ON activity_log;
DROP POLICY IF EXISTS "Super Admin delete" ON activity_log;

-- commission_calculations
DROP POLICY IF EXISTS "Super Admin full access" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin update" ON commission_calculations;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_calculations;

-- commission_periods
DROP POLICY IF EXISTS "Super Admin full access" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin update" ON commission_periods;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_periods;

-- commission_report_items
DROP POLICY IF EXISTS "Super Admin full access" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin update" ON commission_report_items;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_report_items;

-- commission_reports
DROP POLICY IF EXISTS "Super Admin full access" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin update" ON commission_reports;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_reports;

-- commission_rules
DROP POLICY IF EXISTS "Super Admin full access" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin update" ON commission_rules;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_rules;

-- commission_settings
DROP POLICY IF EXISTS "Super Admin full access" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin insert" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin update" ON commission_settings;
DROP POLICY IF EXISTS "Super Admin delete" ON commission_settings;

-- compliance_events
DROP POLICY IF EXISTS "Super Admin full access" ON compliance_events;
DROP POLICY IF EXISTS "Super Admin insert" ON compliance_events;
DROP POLICY IF EXISTS "Super Admin update" ON compliance_events;
DROP POLICY IF EXISTS "Super Admin delete" ON compliance_events;

-- deficiencies
DROP POLICY IF EXISTS "Super Admin full access" ON deficiencies;
DROP POLICY IF EXISTS "Super Admin insert" ON deficiencies;
DROP POLICY IF EXISTS "Super Admin update" ON deficiencies;
DROP POLICY IF EXISTS "Super Admin delete" ON deficiencies;

-- deployment_facilities
DROP POLICY IF EXISTS "Super Admin full access" ON deployment_facilities;
DROP POLICY IF EXISTS "Super Admin insert" ON deployment_facilities;
DROP POLICY IF EXISTS "Super Admin update" ON deployment_facilities;
DROP POLICY IF EXISTS "Super Admin delete" ON deployment_facilities;

-- deployment_organizations
DROP POLICY IF EXISTS "Super Admin full access" ON deployment_organizations;
DROP POLICY IF EXISTS "Super Admin insert" ON deployment_organizations;
DROP POLICY IF EXISTS "Super Admin update" ON deployment_organizations;
DROP POLICY IF EXISTS "Super Admin delete" ON deployment_organizations;

-- deployment_projects
DROP POLICY IF EXISTS "Super Admin full access" ON deployment_projects;
DROP POLICY IF EXISTS "Super Admin insert" ON deployment_projects;
DROP POLICY IF EXISTS "Super Admin update" ON deployment_projects;
DROP POLICY IF EXISTS "Super Admin delete" ON deployment_projects;

-- deployment_templates
DROP POLICY IF EXISTS "Super Admin full access" ON deployment_templates;
DROP POLICY IF EXISTS "Super Admin insert" ON deployment_templates;
DROP POLICY IF EXISTS "Super Admin update" ON deployment_templates;
DROP POLICY IF EXISTS "Super Admin delete" ON deployment_templates;

-- documents
DROP POLICY IF EXISTS "Super Admin full access" ON documents;
DROP POLICY IF EXISTS "Super Admin insert" ON documents;
DROP POLICY IF EXISTS "Super Admin update" ON documents;
DROP POLICY IF EXISTS "Super Admin delete" ON documents;

-- equipment
DROP POLICY IF EXISTS "Super Admin full access" ON equipment;
DROP POLICY IF EXISTS "Super Admin insert" ON equipment;
DROP POLICY IF EXISTS "Super Admin update" ON equipment;
DROP POLICY IF EXISTS "Super Admin delete" ON equipment;

-- equipment_catalog
DROP POLICY IF EXISTS "Super Admin full access" ON equipment_catalog;
DROP POLICY IF EXISTS "Super Admin insert" ON equipment_catalog;
DROP POLICY IF EXISTS "Super Admin update" ON equipment_catalog;
DROP POLICY IF EXISTS "Super Admin delete" ON equipment_catalog;

-- equipment_catalog_documents
DROP POLICY IF EXISTS "Super Admin full access" ON equipment_catalog_documents;
DROP POLICY IF EXISTS "Super Admin insert" ON equipment_catalog_documents;
DROP POLICY IF EXISTS "Super Admin update" ON equipment_catalog_documents;
DROP POLICY IF EXISTS "Super Admin delete" ON equipment_catalog_documents;

-- facilities
DROP POLICY IF EXISTS "Super Admin full access" ON facilities;
DROP POLICY IF EXISTS "Super Admin insert" ON facilities;
DROP POLICY IF EXISTS "Super Admin update" ON facilities;
DROP POLICY IF EXISTS "Super Admin delete" ON facilities;

-- facility_contacts
DROP POLICY IF EXISTS "Super Admin full access" ON facility_contacts;
DROP POLICY IF EXISTS "Super Admin insert" ON facility_contacts;
DROP POLICY IF EXISTS "Super Admin update" ON facility_contacts;
DROP POLICY IF EXISTS "Super Admin delete" ON facility_contacts;

-- facility_readiness_info
DROP POLICY IF EXISTS "Super Admin full access" ON facility_readiness_info;
DROP POLICY IF EXISTS "Super Admin insert" ON facility_readiness_info;
DROP POLICY IF EXISTS "Super Admin update" ON facility_readiness_info;
DROP POLICY IF EXISTS "Super Admin delete" ON facility_readiness_info;

-- facility_tasks
DROP POLICY IF EXISTS "Super Admin full access" ON facility_tasks;
DROP POLICY IF EXISTS "Super Admin insert" ON facility_tasks;
DROP POLICY IF EXISTS "Super Admin update" ON facility_tasks;
DROP POLICY IF EXISTS "Super Admin delete" ON facility_tasks;

-- integration_info
DROP POLICY IF EXISTS "Super Admin full access" ON integration_info;
DROP POLICY IF EXISTS "Super Admin insert" ON integration_info;
DROP POLICY IF EXISTS "Super Admin update" ON integration_info;
DROP POLICY IF EXISTS "Super Admin delete" ON integration_info;

-- interface_status
DROP POLICY IF EXISTS "Super Admin full access" ON interface_status;
DROP POLICY IF EXISTS "Super Admin insert" ON interface_status;
DROP POLICY IF EXISTS "Super Admin update" ON interface_status;
DROP POLICY IF EXISTS "Super Admin delete" ON interface_status;

-- lab_order_confirmations
DROP POLICY IF EXISTS "Super Admin full access" ON lab_order_confirmations;
DROP POLICY IF EXISTS "Super Admin insert" ON lab_order_confirmations;
DROP POLICY IF EXISTS "Super Admin update" ON lab_order_confirmations;
DROP POLICY IF EXISTS "Super Admin delete" ON lab_order_confirmations;

-- lab_orders
DROP POLICY IF EXISTS "Super Admin full access" ON lab_orders;
DROP POLICY IF EXISTS "Super Admin insert" ON lab_orders;
DROP POLICY IF EXISTS "Super Admin update" ON lab_orders;
DROP POLICY IF EXISTS "Super Admin delete" ON lab_orders;

-- lab_results
DROP POLICY IF EXISTS "Super Admin full access" ON lab_results;
DROP POLICY IF EXISTS "Super Admin insert" ON lab_results;
DROP POLICY IF EXISTS "Super Admin update" ON lab_results;
DROP POLICY IF EXISTS "Super Admin delete" ON lab_results;

-- milestone_tasks
DROP POLICY IF EXISTS "Super Admin full access" ON milestone_tasks;
DROP POLICY IF EXISTS "Super Admin insert" ON milestone_tasks;
DROP POLICY IF EXISTS "Super Admin update" ON milestone_tasks;
DROP POLICY IF EXISTS "Super Admin delete" ON milestone_tasks;

-- milestone_templates
DROP POLICY IF EXISTS "Super Admin full access" ON milestone_templates;
DROP POLICY IF EXISTS "Super Admin insert" ON milestone_templates;
DROP POLICY IF EXISTS "Super Admin update" ON milestone_templates;
DROP POLICY IF EXISTS "Super Admin delete" ON milestone_templates;

-- milestones
DROP POLICY IF EXISTS "Super Admin full access" ON milestones;
DROP POLICY IF EXISTS "Super Admin insert" ON milestones;
DROP POLICY IF EXISTS "Super Admin update" ON milestones;
DROP POLICY IF EXISTS "Super Admin delete" ON milestones;

-- n8n_webhook_logs
DROP POLICY IF EXISTS "Super Admin full access" ON n8n_webhook_logs;
DROP POLICY IF EXISTS "Super Admin insert" ON n8n_webhook_logs;
DROP POLICY IF EXISTS "Super Admin update" ON n8n_webhook_logs;
DROP POLICY IF EXISTS "Super Admin delete" ON n8n_webhook_logs;

-- notes
DROP POLICY IF EXISTS "Super Admin full access" ON notes;
DROP POLICY IF EXISTS "Super Admin insert" ON notes;
DROP POLICY IF EXISTS "Super Admin update" ON notes;
DROP POLICY IF EXISTS "Super Admin delete" ON notes;

-- notifications
DROP POLICY IF EXISTS "Super Admin full access" ON notifications;
DROP POLICY IF EXISTS "Super Admin insert" ON notifications;
DROP POLICY IF EXISTS "Super Admin update" ON notifications;
DROP POLICY IF EXISTS "Super Admin delete" ON notifications;

-- organizations
DROP POLICY IF EXISTS "Super Admin full access" ON organizations;
DROP POLICY IF EXISTS "Super Admin insert" ON organizations;
DROP POLICY IF EXISTS "Super Admin update" ON organizations;
DROP POLICY IF EXISTS "Super Admin delete" ON organizations;

-- personnel_info
DROP POLICY IF EXISTS "Super Admin full access" ON personnel_info;
DROP POLICY IF EXISTS "Super Admin insert" ON personnel_info;
DROP POLICY IF EXISTS "Super Admin update" ON personnel_info;
DROP POLICY IF EXISTS "Super Admin delete" ON personnel_info;

-- projects
DROP POLICY IF EXISTS "Super Admin full access" ON projects;
DROP POLICY IF EXISTS "Super Admin insert" ON projects;
DROP POLICY IF EXISTS "Super Admin update" ON projects;
DROP POLICY IF EXISTS "Super Admin delete" ON projects;

-- qb_import_batches
DROP POLICY IF EXISTS "Super Admin full access" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin insert" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin update" ON qb_import_batches;
DROP POLICY IF EXISTS "Super Admin delete" ON qb_import_batches;

-- qbo_invoice_line_items
DROP POLICY IF EXISTS "Super Admin full access" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin insert" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin update" ON qbo_invoice_line_items;
DROP POLICY IF EXISTS "Super Admin delete" ON qbo_invoice_line_items;

-- qbo_invoices
DROP POLICY IF EXISTS "Super Admin full access" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin insert" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin update" ON qbo_invoices;
DROP POLICY IF EXISTS "Super Admin delete" ON qbo_invoices;

-- reference_data
DROP POLICY IF EXISTS "Super Admin full access" ON reference_data;
DROP POLICY IF EXISTS "Super Admin insert" ON reference_data;
DROP POLICY IF EXISTS "Super Admin update" ON reference_data;
DROP POLICY IF EXISTS "Super Admin delete" ON reference_data;

-- reference_data_audit
DROP POLICY IF EXISTS "Super Admin full access" ON reference_data_audit;
DROP POLICY IF EXISTS "Super Admin insert" ON reference_data_audit;
DROP POLICY IF EXISTS "Super Admin update" ON reference_data_audit;
DROP POLICY IF EXISTS "Super Admin delete" ON reference_data_audit;

-- regulatory_info
DROP POLICY IF EXISTS "Super Admin full access" ON regulatory_info;
DROP POLICY IF EXISTS "Super Admin insert" ON regulatory_info;
DROP POLICY IF EXISTS "Super Admin update" ON regulatory_info;
DROP POLICY IF EXISTS "Super Admin delete" ON regulatory_info;

-- responsibilities
DROP POLICY IF EXISTS "Super Admin full access" ON responsibilities;
DROP POLICY IF EXISTS "Super Admin insert" ON responsibilities;
DROP POLICY IF EXISTS "Super Admin update" ON responsibilities;
DROP POLICY IF EXISTS "Super Admin delete" ON responsibilities;

-- sales_reps
DROP POLICY IF EXISTS "Super Admin full access" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin insert" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin update" ON sales_reps;
DROP POLICY IF EXISTS "Super Admin delete" ON sales_reps;

-- site_equipment
DROP POLICY IF EXISTS "Super Admin full access" ON site_equipment;
DROP POLICY IF EXISTS "Super Admin insert" ON site_equipment;
DROP POLICY IF EXISTS "Super Admin update" ON site_equipment;
DROP POLICY IF EXISTS "Super Admin delete" ON site_equipment;

-- site_test_menu
DROP POLICY IF EXISTS "Super Admin full access" ON site_test_menu;
DROP POLICY IF EXISTS "Super Admin insert" ON site_test_menu;
DROP POLICY IF EXISTS "Super Admin update" ON site_test_menu;
DROP POLICY IF EXISTS "Super Admin delete" ON site_test_menu;

-- stratus_confirmations
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_confirmations;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_confirmations;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_confirmations;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_confirmations;

-- stratus_facility_mappings
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_facility_mappings;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_facility_mappings;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_facility_mappings;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_facility_mappings;

-- stratus_orders
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_orders;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_orders;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_orders;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_orders;

-- stratus_organizations
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_organizations;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_organizations;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_organizations;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_organizations;

-- stratus_results
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_results;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_results;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_results;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_results;

-- stratus_test_methods
DROP POLICY IF EXISTS "Super Admin full access" ON stratus_test_methods;
DROP POLICY IF EXISTS "Super Admin insert" ON stratus_test_methods;
DROP POLICY IF EXISTS "Super Admin update" ON stratus_test_methods;
DROP POLICY IF EXISTS "Super Admin delete" ON stratus_test_methods;

-- support_tickets
DROP POLICY IF EXISTS "Super Admin full access" ON support_tickets;
DROP POLICY IF EXISTS "Super Admin insert" ON support_tickets;
DROP POLICY IF EXISTS "Super Admin update" ON support_tickets;
DROP POLICY IF EXISTS "Super Admin delete" ON support_tickets;

-- task_comments
DROP POLICY IF EXISTS "Super Admin full access" ON task_comments;
DROP POLICY IF EXISTS "Super Admin insert" ON task_comments;
DROP POLICY IF EXISTS "Super Admin update" ON task_comments;
DROP POLICY IF EXISTS "Super Admin delete" ON task_comments;

-- template_equipment
DROP POLICY IF EXISTS "Super Admin full access" ON template_equipment;
DROP POLICY IF EXISTS "Super Admin insert" ON template_equipment;
DROP POLICY IF EXISTS "Super Admin update" ON template_equipment;
DROP POLICY IF EXISTS "Super Admin delete" ON template_equipment;

-- template_milestones
DROP POLICY IF EXISTS "Super Admin full access" ON template_milestones;
DROP POLICY IF EXISTS "Super Admin insert" ON template_milestones;
DROP POLICY IF EXISTS "Super Admin update" ON template_milestones;
DROP POLICY IF EXISTS "Super Admin delete" ON template_milestones;

-- test_catalog
DROP POLICY IF EXISTS "Super Admin full access" ON test_catalog;
DROP POLICY IF EXISTS "Super Admin insert" ON test_catalog;
DROP POLICY IF EXISTS "Super Admin update" ON test_catalog;
DROP POLICY IF EXISTS "Super Admin delete" ON test_catalog;

-- ticket_messages
DROP POLICY IF EXISTS "Super Admin full access" ON ticket_messages;
DROP POLICY IF EXISTS "Super Admin insert" ON ticket_messages;
DROP POLICY IF EXISTS "Super Admin update" ON ticket_messages;
DROP POLICY IF EXISTS "Super Admin delete" ON ticket_messages;

-- tracker_facilities
DROP POLICY IF EXISTS "Super Admin full access" ON tracker_facilities;
DROP POLICY IF EXISTS "Super Admin insert" ON tracker_facilities;
DROP POLICY IF EXISTS "Super Admin update" ON tracker_facilities;
DROP POLICY IF EXISTS "Super Admin delete" ON tracker_facilities;

-- tracker_organizations
DROP POLICY IF EXISTS "Super Admin full access" ON tracker_organizations;
DROP POLICY IF EXISTS "Super Admin insert" ON tracker_organizations;
DROP POLICY IF EXISTS "Super Admin update" ON tracker_organizations;
DROP POLICY IF EXISTS "Super Admin delete" ON tracker_organizations;

-- tracker_projects
DROP POLICY IF EXISTS "Super Admin full access" ON tracker_projects;
DROP POLICY IF EXISTS "Super Admin insert" ON tracker_projects;
DROP POLICY IF EXISTS "Super Admin update" ON tracker_projects;
DROP POLICY IF EXISTS "Super Admin delete" ON tracker_projects;

-- trained_personnel
DROP POLICY IF EXISTS "Super Admin full access" ON trained_personnel;
DROP POLICY IF EXISTS "Super Admin insert" ON trained_personnel;
DROP POLICY IF EXISTS "Super Admin update" ON trained_personnel;
DROP POLICY IF EXISTS "Super Admin delete" ON trained_personnel;

-- training_info
DROP POLICY IF EXISTS "Super Admin full access" ON training_info;
DROP POLICY IF EXISTS "Super Admin insert" ON training_info;
DROP POLICY IF EXISTS "Super Admin update" ON training_info;
DROP POLICY IF EXISTS "Super Admin delete" ON training_info;

-- unified_documents
DROP POLICY IF EXISTS "Super Admin full access" ON unified_documents;
DROP POLICY IF EXISTS "Super Admin insert" ON unified_documents;
DROP POLICY IF EXISTS "Super Admin update" ON unified_documents;
DROP POLICY IF EXISTS "Super Admin delete" ON unified_documents;

-- user_invitations
DROP POLICY IF EXISTS "Super Admin full access" ON user_invitations;
DROP POLICY IF EXISTS "Super Admin insert" ON user_invitations;
DROP POLICY IF EXISTS "Super Admin update" ON user_invitations;
DROP POLICY IF EXISTS "Super Admin delete" ON user_invitations;

-- user_organization_assignments
DROP POLICY IF EXISTS "Super Admin full access" ON user_organization_assignments;
DROP POLICY IF EXISTS "Super Admin insert" ON user_organization_assignments;
DROP POLICY IF EXISTS "Super Admin update" ON user_organization_assignments;
DROP POLICY IF EXISTS "Super Admin delete" ON user_organization_assignments;

-- user_roles
DROP POLICY IF EXISTS "Super Admin full access" ON user_roles;
DROP POLICY IF EXISTS "Super Admin insert" ON user_roles;
DROP POLICY IF EXISTS "Super Admin update" ON user_roles;
DROP POLICY IF EXISTS "Super Admin delete" ON user_roles;
