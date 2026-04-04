/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for all foreign key columns that lack them across
  the public schema. Without these indexes, JOIN and lookup queries on
  these columns perform sequential table scans, which degrades performance
  as data grows.

  ## Tables affected
  - activity_log: organization_id, user_id
  - commission_calculations: commission_rule_id
  - commission_report_items: calculation_id, invoice_id
  - commission_reports: commission_period_id
  - commission_settings: updated_by
  - compliance_events: created_by
  - deficiencies: assigned_to
  - deployment_templates: created_by, organization_id
  - documents: uploaded_by
  - equipment_catalog: organization_id
  - facilities: created_by, deployment_template_id, updated_by
  - facility_contacts: created_by, updated_by
  - interface_status: integration_info_id
  - milestone_templates: organization_id
  - notes: created_by
  - notifications: organization_id
  - organizations: default_deployment_template_id
  - qb_import_batches: imported_by
  - qbo_invoices: import_batch_id
  - reference_data: created_by
  - reference_data_audit: changed_by, reference_data_id
  - responsibilities: user_id
  - site_equipment: equipment_catalog_id
  - site_test_menu: test_catalog_id
  - stratus_orders: created_by
  - support_tickets: assigned_to, created_by
  - template_equipment: equipment_catalog_id
  - template_milestones: milestone_template_id
  - ticket_messages: user_id
  - unified_documents: replaced_by_document_id, replaces_document_id, uploaded_by
  - user_invitations: invited_by
  - user_organization_assignments: assigned_by
  - user_roles: organization_id
*/

CREATE INDEX IF NOT EXISTS idx_activity_log_organization_id ON public.activity_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log (user_id);

CREATE INDEX IF NOT EXISTS idx_commission_calculations_rule_id ON public.commission_calculations (commission_rule_id);

CREATE INDEX IF NOT EXISTS idx_commission_report_items_calculation_id ON public.commission_report_items (calculation_id);
CREATE INDEX IF NOT EXISTS idx_commission_report_items_invoice_id ON public.commission_report_items (invoice_id);

CREATE INDEX IF NOT EXISTS idx_commission_reports_period_id ON public.commission_reports (commission_period_id);

CREATE INDEX IF NOT EXISTS idx_commission_settings_updated_by ON public.commission_settings (updated_by);

CREATE INDEX IF NOT EXISTS idx_compliance_events_created_by ON public.compliance_events (created_by);

CREATE INDEX IF NOT EXISTS idx_deficiencies_assigned_to ON public.deficiencies (assigned_to);

CREATE INDEX IF NOT EXISTS idx_deployment_templates_created_by ON public.deployment_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_deployment_templates_organization_id ON public.deployment_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_organization_id ON public.equipment_catalog (organization_id);

CREATE INDEX IF NOT EXISTS idx_facilities_created_by ON public.facilities (created_by);
CREATE INDEX IF NOT EXISTS idx_facilities_deployment_template_id ON public.facilities (deployment_template_id);
CREATE INDEX IF NOT EXISTS idx_facilities_updated_by ON public.facilities (updated_by);

CREATE INDEX IF NOT EXISTS idx_facility_contacts_created_by ON public.facility_contacts (created_by);
CREATE INDEX IF NOT EXISTS idx_facility_contacts_updated_by ON public.facility_contacts (updated_by);

CREATE INDEX IF NOT EXISTS idx_interface_status_integration_info_id ON public.interface_status (integration_info_id);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_organization_id ON public.milestone_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes (created_by);

CREATE INDEX IF NOT EXISTS idx_notifications_organization_id ON public.notifications (organization_id);

CREATE INDEX IF NOT EXISTS idx_organizations_default_deployment_template_id ON public.organizations (default_deployment_template_id);

CREATE INDEX IF NOT EXISTS idx_qb_import_batches_imported_by ON public.qb_import_batches (imported_by);

CREATE INDEX IF NOT EXISTS idx_qbo_invoices_import_batch_id ON public.qbo_invoices (import_batch_id);

CREATE INDEX IF NOT EXISTS idx_reference_data_created_by ON public.reference_data (created_by);

CREATE INDEX IF NOT EXISTS idx_reference_data_audit_changed_by ON public.reference_data_audit (changed_by);
CREATE INDEX IF NOT EXISTS idx_reference_data_audit_reference_data_id ON public.reference_data_audit (reference_data_id);

CREATE INDEX IF NOT EXISTS idx_responsibilities_user_id ON public.responsibilities (user_id);

CREATE INDEX IF NOT EXISTS idx_site_equipment_equipment_catalog_id ON public.site_equipment (equipment_catalog_id);

CREATE INDEX IF NOT EXISTS idx_site_test_menu_test_catalog_id ON public.site_test_menu (test_catalog_id);

CREATE INDEX IF NOT EXISTS idx_stratus_orders_created_by ON public.stratus_orders (created_by);

CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON public.support_tickets (created_by);

CREATE INDEX IF NOT EXISTS idx_template_equipment_equipment_catalog_id ON public.template_equipment (equipment_catalog_id);

CREATE INDEX IF NOT EXISTS idx_template_milestones_milestone_template_id ON public.template_milestones (milestone_template_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON public.ticket_messages (user_id);

CREATE INDEX IF NOT EXISTS idx_unified_documents_replaced_by_document_id ON public.unified_documents (replaced_by_document_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_replaces_document_id ON public.unified_documents (replaces_document_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_uploaded_by ON public.unified_documents (uploaded_by);

CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by ON public.user_invitations (invited_by);

CREATE INDEX IF NOT EXISTS idx_user_organization_assignments_assigned_by ON public.user_organization_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON public.user_roles (organization_id);
