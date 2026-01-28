/*
  # Update RLS Policies for Support Tickets, Notifications, and Templates
  
  This migration updates RLS policies for support-related tables, notifications,
  and template/catalog tables to enforce organization-based access control.
  
  ## Tables Updated
  - support_tickets
  - ticket_messages  
  - notifications
  - user_roles
  - deployment_templates
  - equipment_catalog
  - milestone_templates
  - template_equipment
  - template_milestones
  - test_catalog
  - reference_data
  - reference_data_audit
*/

-- Support Tickets table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON support_tickets;
DROP POLICY IF EXISTS "Users can view support_tickets" ON support_tickets;
DROP POLICY IF EXISTS "Authenticated users can read support_tickets" ON support_tickets;
DROP POLICY IF EXISTS "Staff can manage support_tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can update accessible tickets" ON support_tickets;
DROP POLICY IF EXISTS "Internal users can delete tickets" ON support_tickets;

CREATE POLICY "Users can view tickets for accessible organizations" ON support_tickets
  FOR SELECT USING (
    is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Users can create tickets for accessible organizations" ON support_tickets
  FOR INSERT WITH CHECK (
    is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Users can update accessible tickets" ON support_tickets
  FOR UPDATE USING (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), organization_id)
      AND created_by = auth.uid()
    )
  ) WITH CHECK (
    is_internal_user(auth.uid())
    OR (
      user_can_access_organization(auth.uid(), organization_id)
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Internal users can delete tickets" ON support_tickets
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Ticket Messages table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON ticket_messages;
DROP POLICY IF EXISTS "Users can view ticket_messages" ON ticket_messages;
DROP POLICY IF EXISTS "Authenticated users can read ticket_messages" ON ticket_messages;
DROP POLICY IF EXISTS "Staff can manage ticket_messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can view messages for accessible tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON ticket_messages;
DROP POLICY IF EXISTS "Internal users can delete messages" ON ticket_messages;

CREATE POLICY "Users can view messages for accessible tickets" ON ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        is_internal_user(auth.uid())
        OR (
          user_can_access_organization(auth.uid(), st.organization_id)
          AND (ticket_messages.is_internal = false OR is_internal_user(auth.uid()))
        )
      )
    )
  );

CREATE POLICY "Users can create messages for accessible tickets" ON ticket_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        is_internal_user(auth.uid())
        OR user_can_access_organization(auth.uid(), st.organization_id)
      )
    )
    AND (
      ticket_messages.is_internal = false
      OR is_internal_user(auth.uid())
    )
  );

CREATE POLICY "Users can update own messages" ON ticket_messages
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_internal_user(auth.uid())
  );

CREATE POLICY "Internal users can delete messages" ON ticket_messages
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Notifications table
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- User Roles table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON user_roles;
DROP POLICY IF EXISTS "Users can view user_roles" ON user_roles;
DROP POLICY IF EXISTS "Authenticated users can read user_roles" ON user_roles;
DROP POLICY IF EXISTS "Staff can manage user_roles" ON user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view accessible user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can insert user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins and managers can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;

CREATE POLICY "Users can view accessible user roles" ON user_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_internal_user(auth.uid())
    OR (
      organization_id IS NOT NULL 
      AND user_can_access_organization(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Admins and managers can insert user roles" ON user_roles
  FOR INSERT WITH CHECK (
    is_admin_or_manager(auth.uid())
  );

CREATE POLICY "Admins and managers can update user roles" ON user_roles
  FOR UPDATE USING (
    is_admin_or_manager(auth.uid())
  ) WITH CHECK (
    is_admin_or_manager(auth.uid())
  );

CREATE POLICY "Admins can delete user roles" ON user_roles
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Deployment Templates
DROP POLICY IF EXISTS "Public read access for authenticated users" ON deployment_templates;
DROP POLICY IF EXISTS "Users can view deployment_templates" ON deployment_templates;
DROP POLICY IF EXISTS "Authenticated users can read deployment_templates" ON deployment_templates;
DROP POLICY IF EXISTS "Staff can manage deployment_templates" ON deployment_templates;
DROP POLICY IF EXISTS "Users can view accessible deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Internal users can manage deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Internal users can update deployment templates" ON deployment_templates;
DROP POLICY IF EXISTS "Admins can delete deployment templates" ON deployment_templates;

CREATE POLICY "Users can view accessible deployment templates" ON deployment_templates
  FOR SELECT USING (
    is_system_template = true
    OR organization_id IS NULL
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Internal users can manage deployment templates" ON deployment_templates
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update deployment templates" ON deployment_templates
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete deployment templates" ON deployment_templates
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Equipment Catalog
DROP POLICY IF EXISTS "Public read access for authenticated users" ON equipment_catalog;
DROP POLICY IF EXISTS "Users can view equipment_catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Authenticated users can read equipment_catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Staff can manage equipment_catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Users can view accessible equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Internal users can manage equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Internal users can update equipment catalog" ON equipment_catalog;
DROP POLICY IF EXISTS "Admins can delete equipment catalog" ON equipment_catalog;

CREATE POLICY "Users can view accessible equipment catalog" ON equipment_catalog
  FOR SELECT USING (
    is_system_item = true
    OR organization_id IS NULL
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Internal users can manage equipment catalog" ON equipment_catalog
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update equipment catalog" ON equipment_catalog
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete equipment catalog" ON equipment_catalog
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Milestone Templates
DROP POLICY IF EXISTS "Public read access for authenticated users" ON milestone_templates;
DROP POLICY IF EXISTS "Users can view milestone_templates" ON milestone_templates;
DROP POLICY IF EXISTS "Authenticated users can read milestone_templates" ON milestone_templates;
DROP POLICY IF EXISTS "Staff can manage milestone_templates" ON milestone_templates;
DROP POLICY IF EXISTS "Users can view accessible milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Internal users can manage milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Internal users can update milestone templates" ON milestone_templates;
DROP POLICY IF EXISTS "Admins can delete milestone templates" ON milestone_templates;

CREATE POLICY "Users can view accessible milestone templates" ON milestone_templates
  FOR SELECT USING (
    is_system_template = true
    OR organization_id IS NULL
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

CREATE POLICY "Internal users can manage milestone templates" ON milestone_templates
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update milestone templates" ON milestone_templates
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete milestone templates" ON milestone_templates
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Template Equipment
DROP POLICY IF EXISTS "Public read access for authenticated users" ON template_equipment;
DROP POLICY IF EXISTS "Users can view template_equipment" ON template_equipment;
DROP POLICY IF EXISTS "Authenticated users can read template_equipment" ON template_equipment;
DROP POLICY IF EXISTS "Staff can manage template_equipment" ON template_equipment;
DROP POLICY IF EXISTS "Users can view template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Internal users can manage template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Internal users can update template equipment" ON template_equipment;
DROP POLICY IF EXISTS "Admins can delete template equipment" ON template_equipment;

CREATE POLICY "Users can view template equipment" ON template_equipment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deployment_templates dt
      WHERE dt.id = template_equipment.template_id
      AND (
        dt.is_system_template = true
        OR dt.organization_id IS NULL
        OR is_internal_user(auth.uid())
        OR user_can_access_organization(auth.uid(), dt.organization_id)
      )
    )
  );

CREATE POLICY "Internal users can manage template equipment" ON template_equipment
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update template equipment" ON template_equipment
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete template equipment" ON template_equipment
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Template Milestones
DROP POLICY IF EXISTS "Public read access for authenticated users" ON template_milestones;
DROP POLICY IF EXISTS "Users can view template_milestones" ON template_milestones;
DROP POLICY IF EXISTS "Authenticated users can read template_milestones" ON template_milestones;
DROP POLICY IF EXISTS "Staff can manage template_milestones" ON template_milestones;
DROP POLICY IF EXISTS "Users can view template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Internal users can manage template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Internal users can update template milestones" ON template_milestones;
DROP POLICY IF EXISTS "Admins can delete template milestones" ON template_milestones;

CREATE POLICY "Users can view template milestones" ON template_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM deployment_templates dt
      WHERE dt.id = template_milestones.deployment_template_id
      AND (
        dt.is_system_template = true
        OR dt.organization_id IS NULL
        OR is_internal_user(auth.uid())
        OR user_can_access_organization(auth.uid(), dt.organization_id)
      )
    )
  );

CREATE POLICY "Internal users can manage template milestones" ON template_milestones
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update template milestones" ON template_milestones
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete template milestones" ON template_milestones
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Test Catalog
DROP POLICY IF EXISTS "Public read access for authenticated users" ON test_catalog;
DROP POLICY IF EXISTS "Users can view test_catalog" ON test_catalog;
DROP POLICY IF EXISTS "Authenticated users can read test_catalog" ON test_catalog;
DROP POLICY IF EXISTS "Authenticated users can view test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Staff can manage test_catalog" ON test_catalog;
DROP POLICY IF EXISTS "Internal users can manage test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Internal users can update test catalog" ON test_catalog;
DROP POLICY IF EXISTS "Admins can delete test catalog" ON test_catalog;

CREATE POLICY "Authenticated users can view test catalog" ON test_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Internal users can manage test catalog" ON test_catalog
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update test catalog" ON test_catalog
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete test catalog" ON test_catalog
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Reference Data
DROP POLICY IF EXISTS "Public read access for authenticated users" ON reference_data;
DROP POLICY IF EXISTS "Users can view reference_data" ON reference_data;
DROP POLICY IF EXISTS "Authenticated users can read reference_data" ON reference_data;
DROP POLICY IF EXISTS "Authenticated users can view reference data" ON reference_data;
DROP POLICY IF EXISTS "Staff can manage reference_data" ON reference_data;
DROP POLICY IF EXISTS "Admins can manage reference data" ON reference_data;
DROP POLICY IF EXISTS "Internal users can manage reference data" ON reference_data;
DROP POLICY IF EXISTS "Internal users can update reference data" ON reference_data;
DROP POLICY IF EXISTS "Admins can delete reference data" ON reference_data;

CREATE POLICY "Authenticated users can view reference data" ON reference_data
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Internal users can manage reference data" ON reference_data
  FOR INSERT WITH CHECK (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can update reference data" ON reference_data
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Admins can delete reference data" ON reference_data
  FOR DELETE USING (is_admin_user(auth.uid()));

-- Reference Data Audit
DROP POLICY IF EXISTS "Public read access for authenticated users" ON reference_data_audit;
DROP POLICY IF EXISTS "Users can view reference_data_audit" ON reference_data_audit;
DROP POLICY IF EXISTS "Authenticated users can read reference_data_audit" ON reference_data_audit;
DROP POLICY IF EXISTS "Internal users can view reference data audit" ON reference_data_audit;
DROP POLICY IF EXISTS "Staff can manage reference_data_audit" ON reference_data_audit;
DROP POLICY IF EXISTS "Authenticated users can insert audit records" ON reference_data_audit;

CREATE POLICY "Internal users can view reference data audit" ON reference_data_audit
  FOR SELECT USING (is_internal_user(auth.uid()));

CREATE POLICY "Authenticated users can insert audit records" ON reference_data_audit
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
