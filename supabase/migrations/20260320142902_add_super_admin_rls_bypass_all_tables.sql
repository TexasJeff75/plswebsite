/*
  # Super Admin RLS Bypass - Full Access to All Tables

  ## Summary
  Adds RLS policies granting 'Super Admin' role full read/write access to every table
  in the public schema. Super Admin bypasses all existing restrictions and can perform
  any SELECT, INSERT, UPDATE, or DELETE operation on all tables.

  ## Tables Covered
  All 68 tables in the public schema including commissions, facilities, organizations,
  users, documents, labs, stratus, support, and all reference/template tables.

  ## Security Notes
  - Policies use a helper function `is_super_admin()` to avoid repetition and ensure
    the check runs efficiently with a security definer context
  - The function reads from user_roles using the authenticated user's JWT sub (uid)
  - Super Admin is a privileged internal role — assign with care
*/

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'Super Admin'
  );
$$;

-- activity_log
CREATE POLICY "Super Admin full access" ON activity_log FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON activity_log FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON activity_log FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON activity_log FOR DELETE TO authenticated USING (is_super_admin());

-- commission_calculations
CREATE POLICY "Super Admin full access" ON commission_calculations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_calculations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_calculations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_calculations FOR DELETE TO authenticated USING (is_super_admin());

-- commission_periods
CREATE POLICY "Super Admin full access" ON commission_periods FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_periods FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_periods FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_periods FOR DELETE TO authenticated USING (is_super_admin());

-- commission_report_items
CREATE POLICY "Super Admin full access" ON commission_report_items FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_report_items FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_report_items FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_report_items FOR DELETE TO authenticated USING (is_super_admin());

-- commission_reports
CREATE POLICY "Super Admin full access" ON commission_reports FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_reports FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_reports FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_reports FOR DELETE TO authenticated USING (is_super_admin());

-- commission_rules
CREATE POLICY "Super Admin full access" ON commission_rules FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_rules FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_rules FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_rules FOR DELETE TO authenticated USING (is_super_admin());

-- commission_settings
CREATE POLICY "Super Admin full access" ON commission_settings FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON commission_settings FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON commission_settings FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON commission_settings FOR DELETE TO authenticated USING (is_super_admin());

-- compliance_events
CREATE POLICY "Super Admin full access" ON compliance_events FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON compliance_events FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON compliance_events FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON compliance_events FOR DELETE TO authenticated USING (is_super_admin());

-- deficiencies
CREATE POLICY "Super Admin full access" ON deficiencies FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON deficiencies FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON deficiencies FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON deficiencies FOR DELETE TO authenticated USING (is_super_admin());

-- deployment_facilities
CREATE POLICY "Super Admin full access" ON deployment_facilities FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON deployment_facilities FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON deployment_facilities FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON deployment_facilities FOR DELETE TO authenticated USING (is_super_admin());

-- deployment_organizations
CREATE POLICY "Super Admin full access" ON deployment_organizations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON deployment_organizations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON deployment_organizations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON deployment_organizations FOR DELETE TO authenticated USING (is_super_admin());

-- deployment_projects
CREATE POLICY "Super Admin full access" ON deployment_projects FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON deployment_projects FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON deployment_projects FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON deployment_projects FOR DELETE TO authenticated USING (is_super_admin());

-- deployment_templates
CREATE POLICY "Super Admin full access" ON deployment_templates FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON deployment_templates FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON deployment_templates FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON deployment_templates FOR DELETE TO authenticated USING (is_super_admin());

-- documents
CREATE POLICY "Super Admin full access" ON documents FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON documents FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON documents FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON documents FOR DELETE TO authenticated USING (is_super_admin());

-- equipment
CREATE POLICY "Super Admin full access" ON equipment FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON equipment FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON equipment FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON equipment FOR DELETE TO authenticated USING (is_super_admin());

-- equipment_catalog
CREATE POLICY "Super Admin full access" ON equipment_catalog FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON equipment_catalog FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON equipment_catalog FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON equipment_catalog FOR DELETE TO authenticated USING (is_super_admin());

-- equipment_catalog_documents
CREATE POLICY "Super Admin full access" ON equipment_catalog_documents FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON equipment_catalog_documents FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON equipment_catalog_documents FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON equipment_catalog_documents FOR DELETE TO authenticated USING (is_super_admin());

-- facilities
CREATE POLICY "Super Admin full access" ON facilities FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON facilities FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON facilities FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON facilities FOR DELETE TO authenticated USING (is_super_admin());

-- facility_contacts
CREATE POLICY "Super Admin full access" ON facility_contacts FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON facility_contacts FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON facility_contacts FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON facility_contacts FOR DELETE TO authenticated USING (is_super_admin());

-- facility_readiness_info
CREATE POLICY "Super Admin full access" ON facility_readiness_info FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON facility_readiness_info FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON facility_readiness_info FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON facility_readiness_info FOR DELETE TO authenticated USING (is_super_admin());

-- facility_tasks
CREATE POLICY "Super Admin full access" ON facility_tasks FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON facility_tasks FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON facility_tasks FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON facility_tasks FOR DELETE TO authenticated USING (is_super_admin());

-- integration_info
CREATE POLICY "Super Admin full access" ON integration_info FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON integration_info FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON integration_info FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON integration_info FOR DELETE TO authenticated USING (is_super_admin());

-- interface_status
CREATE POLICY "Super Admin full access" ON interface_status FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON interface_status FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON interface_status FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON interface_status FOR DELETE TO authenticated USING (is_super_admin());

-- lab_order_confirmations
CREATE POLICY "Super Admin full access" ON lab_order_confirmations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON lab_order_confirmations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON lab_order_confirmations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON lab_order_confirmations FOR DELETE TO authenticated USING (is_super_admin());

-- lab_orders
CREATE POLICY "Super Admin full access" ON lab_orders FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON lab_orders FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON lab_orders FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON lab_orders FOR DELETE TO authenticated USING (is_super_admin());

-- lab_results
CREATE POLICY "Super Admin full access" ON lab_results FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON lab_results FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON lab_results FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON lab_results FOR DELETE TO authenticated USING (is_super_admin());

-- milestone_tasks
CREATE POLICY "Super Admin full access" ON milestone_tasks FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON milestone_tasks FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON milestone_tasks FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON milestone_tasks FOR DELETE TO authenticated USING (is_super_admin());

-- milestone_templates
CREATE POLICY "Super Admin full access" ON milestone_templates FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON milestone_templates FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON milestone_templates FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON milestone_templates FOR DELETE TO authenticated USING (is_super_admin());

-- milestones
CREATE POLICY "Super Admin full access" ON milestones FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON milestones FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON milestones FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON milestones FOR DELETE TO authenticated USING (is_super_admin());

-- n8n_webhook_logs
CREATE POLICY "Super Admin full access" ON n8n_webhook_logs FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON n8n_webhook_logs FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON n8n_webhook_logs FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON n8n_webhook_logs FOR DELETE TO authenticated USING (is_super_admin());

-- notes
CREATE POLICY "Super Admin full access" ON notes FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON notes FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON notes FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON notes FOR DELETE TO authenticated USING (is_super_admin());

-- notifications
CREATE POLICY "Super Admin full access" ON notifications FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON notifications FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON notifications FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON notifications FOR DELETE TO authenticated USING (is_super_admin());

-- organizations
CREATE POLICY "Super Admin full access" ON organizations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON organizations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON organizations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON organizations FOR DELETE TO authenticated USING (is_super_admin());

-- personnel_info
CREATE POLICY "Super Admin full access" ON personnel_info FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON personnel_info FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON personnel_info FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON personnel_info FOR DELETE TO authenticated USING (is_super_admin());

-- projects
CREATE POLICY "Super Admin full access" ON projects FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON projects FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON projects FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON projects FOR DELETE TO authenticated USING (is_super_admin());

-- qb_import_batches
CREATE POLICY "Super Admin full access" ON qb_import_batches FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON qb_import_batches FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON qb_import_batches FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON qb_import_batches FOR DELETE TO authenticated USING (is_super_admin());

-- qbo_invoice_line_items
CREATE POLICY "Super Admin full access" ON qbo_invoice_line_items FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON qbo_invoice_line_items FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON qbo_invoice_line_items FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON qbo_invoice_line_items FOR DELETE TO authenticated USING (is_super_admin());

-- qbo_invoices
CREATE POLICY "Super Admin full access" ON qbo_invoices FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON qbo_invoices FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON qbo_invoices FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON qbo_invoices FOR DELETE TO authenticated USING (is_super_admin());

-- reference_data
CREATE POLICY "Super Admin full access" ON reference_data FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON reference_data FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON reference_data FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON reference_data FOR DELETE TO authenticated USING (is_super_admin());

-- reference_data_audit
CREATE POLICY "Super Admin full access" ON reference_data_audit FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON reference_data_audit FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON reference_data_audit FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON reference_data_audit FOR DELETE TO authenticated USING (is_super_admin());

-- regulatory_info
CREATE POLICY "Super Admin full access" ON regulatory_info FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON regulatory_info FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON regulatory_info FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON regulatory_info FOR DELETE TO authenticated USING (is_super_admin());

-- responsibilities
CREATE POLICY "Super Admin full access" ON responsibilities FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON responsibilities FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON responsibilities FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON responsibilities FOR DELETE TO authenticated USING (is_super_admin());

-- sales_reps
CREATE POLICY "Super Admin full access" ON sales_reps FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON sales_reps FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON sales_reps FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON sales_reps FOR DELETE TO authenticated USING (is_super_admin());

-- site_equipment
CREATE POLICY "Super Admin full access" ON site_equipment FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON site_equipment FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON site_equipment FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON site_equipment FOR DELETE TO authenticated USING (is_super_admin());

-- site_test_menu
CREATE POLICY "Super Admin full access" ON site_test_menu FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON site_test_menu FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON site_test_menu FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON site_test_menu FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_confirmations
CREATE POLICY "Super Admin full access" ON stratus_confirmations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_confirmations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_confirmations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_confirmations FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_facility_mappings
CREATE POLICY "Super Admin full access" ON stratus_facility_mappings FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_facility_mappings FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_facility_mappings FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_facility_mappings FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_orders
CREATE POLICY "Super Admin full access" ON stratus_orders FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_orders FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_orders FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_orders FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_organizations
CREATE POLICY "Super Admin full access" ON stratus_organizations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_organizations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_organizations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_organizations FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_results
CREATE POLICY "Super Admin full access" ON stratus_results FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_results FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_results FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_results FOR DELETE TO authenticated USING (is_super_admin());

-- stratus_test_methods
CREATE POLICY "Super Admin full access" ON stratus_test_methods FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON stratus_test_methods FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON stratus_test_methods FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON stratus_test_methods FOR DELETE TO authenticated USING (is_super_admin());

-- support_tickets
CREATE POLICY "Super Admin full access" ON support_tickets FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON support_tickets FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON support_tickets FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON support_tickets FOR DELETE TO authenticated USING (is_super_admin());

-- task_comments
CREATE POLICY "Super Admin full access" ON task_comments FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON task_comments FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON task_comments FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON task_comments FOR DELETE TO authenticated USING (is_super_admin());

-- template_equipment
CREATE POLICY "Super Admin full access" ON template_equipment FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON template_equipment FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON template_equipment FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON template_equipment FOR DELETE TO authenticated USING (is_super_admin());

-- template_milestones
CREATE POLICY "Super Admin full access" ON template_milestones FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON template_milestones FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON template_milestones FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON template_milestones FOR DELETE TO authenticated USING (is_super_admin());

-- test_catalog
CREATE POLICY "Super Admin full access" ON test_catalog FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON test_catalog FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON test_catalog FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON test_catalog FOR DELETE TO authenticated USING (is_super_admin());

-- ticket_messages
CREATE POLICY "Super Admin full access" ON ticket_messages FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON ticket_messages FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON ticket_messages FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON ticket_messages FOR DELETE TO authenticated USING (is_super_admin());

-- tracker_facilities
CREATE POLICY "Super Admin full access" ON tracker_facilities FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON tracker_facilities FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON tracker_facilities FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON tracker_facilities FOR DELETE TO authenticated USING (is_super_admin());

-- tracker_organizations
CREATE POLICY "Super Admin full access" ON tracker_organizations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON tracker_organizations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON tracker_organizations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON tracker_organizations FOR DELETE TO authenticated USING (is_super_admin());

-- tracker_projects
CREATE POLICY "Super Admin full access" ON tracker_projects FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON tracker_projects FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON tracker_projects FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON tracker_projects FOR DELETE TO authenticated USING (is_super_admin());

-- trained_personnel
CREATE POLICY "Super Admin full access" ON trained_personnel FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON trained_personnel FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON trained_personnel FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON trained_personnel FOR DELETE TO authenticated USING (is_super_admin());

-- training_info
CREATE POLICY "Super Admin full access" ON training_info FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON training_info FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON training_info FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON training_info FOR DELETE TO authenticated USING (is_super_admin());

-- unified_documents
CREATE POLICY "Super Admin full access" ON unified_documents FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON unified_documents FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON unified_documents FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON unified_documents FOR DELETE TO authenticated USING (is_super_admin());

-- user_invitations
CREATE POLICY "Super Admin full access" ON user_invitations FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON user_invitations FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON user_invitations FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON user_invitations FOR DELETE TO authenticated USING (is_super_admin());

-- user_organization_assignments
CREATE POLICY "Super Admin full access" ON user_organization_assignments FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON user_organization_assignments FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON user_organization_assignments FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON user_organization_assignments FOR DELETE TO authenticated USING (is_super_admin());

-- user_roles
CREATE POLICY "Super Admin full access" ON user_roles FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Super Admin insert" ON user_roles FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin update" ON user_roles FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Super Admin delete" ON user_roles FOR DELETE TO authenticated USING (is_super_admin());
