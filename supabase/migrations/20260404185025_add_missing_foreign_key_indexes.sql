
/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for all foreign key columns that lack them,
  improving JOIN and lookup performance across many tables.

  ## Tables Affected
  - activity_log (organization_id, user_id)
  - commission_calculations (commission_rule_id)
  - commission_report_items (calculation_id, invoice_id)
  - commission_reports (commission_period_id)
  - commission_settings (updated_by)
  - compliance_events (created_by)
  - deficiencies (assigned_to)
  - deployment_templates (created_by, organization_id)
  - documents (uploaded_by)
  - equipment_catalog (organization_id)
  - facilities (created_by, deployment_template_id, updated_by)
  - facility_contacts (created_by, updated_by)
  - interface_status (integration_info_id)
  - milestone_templates (organization_id)
  - notes (created_by)
  - notifications (organization_id)
  - organizations (default_deployment_template_id)
  - qb_import_batches (imported_by)
  - qbo_invoices (import_batch_id)
  - reference_data (created_by)
  - reference_data_audit (changed_by, reference_data_id)
  - responsibilities (user_id)
  - site_equipment (equipment_catalog_id)
  - site_test_menu (test_catalog_id)
  - stratus_orders (created_by)
  - support_tickets (assigned_to, created_by)
  - template_equipment (equipment_catalog_id)
  - template_milestones (milestone_template_id)
  - ticket_messages (user_id)
  - unified_documents (replaced_by_document_id, replaces_document_id, uploaded_by)
  - user_invitations (invited_by)
  - user_organization_assignments (assigned_by)
  - user_roles (organization_id)
*/

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

CREATE INDEX IF NOT EXISTS idx_commission_calculations_rule_id ON commission_calculations(commission_rule_id);

CREATE INDEX IF NOT EXISTS idx_commission_report_items_calculation_id ON commission_report_items(calculation_id);
CREATE INDEX IF NOT EXISTS idx_commission_report_items_invoice_id ON commission_report_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_commission_reports_period_id ON commission_reports(commission_period_id);

CREATE INDEX IF NOT EXISTS idx_commission_settings_updated_by ON commission_settings(updated_by);

CREATE INDEX IF NOT EXISTS idx_compliance_events_created_by ON compliance_events(created_by);

CREATE INDEX IF NOT EXISTS idx_deficiencies_assigned_to ON deficiencies(assigned_to);

CREATE INDEX IF NOT EXISTS idx_deployment_templates_created_by ON deployment_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_deployment_templates_organization_id ON deployment_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_organization_id ON equipment_catalog(organization_id);

CREATE INDEX IF NOT EXISTS idx_facilities_created_by ON facilities(created_by);
CREATE INDEX IF NOT EXISTS idx_facilities_deployment_template_id ON facilities(deployment_template_id);
CREATE INDEX IF NOT EXISTS idx_facilities_updated_by ON facilities(updated_by);

CREATE INDEX IF NOT EXISTS idx_facility_contacts_created_by ON facility_contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_facility_contacts_updated_by ON facility_contacts(updated_by);

CREATE INDEX IF NOT EXISTS idx_interface_status_integration_info_id ON interface_status(integration_info_id);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_organization_id ON milestone_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);

CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON notifications(organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_default_deployment_template_id ON organizations(default_deployment_template_id);

CREATE INDEX IF NOT EXISTS idx_qb_import_batches_imported_by ON qb_import_batches(imported_by);

CREATE INDEX IF NOT EXISTS idx_qbo_invoices_import_batch_id ON qbo_invoices(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_reference_data_created_by ON reference_data(created_by);

CREATE INDEX IF NOT EXISTS idx_reference_data_audit_changed_by ON reference_data_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_reference_data_audit_reference_data_id ON reference_data_audit(reference_data_id);

CREATE INDEX IF NOT EXISTS idx_responsibilities_user_id ON responsibilities(user_id);

CREATE INDEX IF NOT EXISTS idx_site_equipment_equipment_catalog_id ON site_equipment(equipment_catalog_id);

CREATE INDEX IF NOT EXISTS idx_site_test_menu_test_catalog_id ON site_test_menu(test_catalog_id);

CREATE INDEX IF NOT EXISTS idx_stratus_orders_created_by ON stratus_orders(created_by);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by);

CREATE INDEX IF NOT EXISTS idx_template_equipment_equipment_catalog_id ON template_equipment(equipment_catalog_id);

CREATE INDEX IF NOT EXISTS idx_template_milestones_milestone_template_id ON template_milestones(milestone_template_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON ticket_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_unified_documents_replaced_by_document_id ON unified_documents(replaced_by_document_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_replaces_document_id ON unified_documents(replaces_document_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_uploaded_by ON unified_documents(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by ON user_invitations(invited_by);

CREATE INDEX IF NOT EXISTS idx_user_org_assignments_assigned_by ON user_organization_assignments(assigned_by);

CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
