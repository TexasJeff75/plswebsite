/*
  # Optimize RLS Policies - Support & Compliance Tables

  This migration optimizes RLS policies for support and compliance tables.

  ## Tables Updated:
  - organizations
  - support_tickets
  - ticket_messages
  - compliance_events
  - deficiencies
*/

-- =============================================
-- ORGANIZATIONS TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Internal users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update accessible organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view assigned organizations" ON organizations;

CREATE POLICY "Users can view accessible organizations"
  ON organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organizations.id
    )
  );

CREATE POLICY "Internal users can create organizations"
  ON organizations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

CREATE POLICY "Users can update accessible organizations"
  ON organizations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organizations.id
      AND uoa.role IN ('Admin', 'Manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = id
      AND uoa.role IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins can delete organizations"
  ON organizations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- =============================================
-- SUPPORT_TICKETS TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete tickets" ON support_tickets;
DROP POLICY IF EXISTS "Customers can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Customers can read their organization tickets" ON support_tickets;
DROP POLICY IF EXISTS "Internal users can delete tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can update accessible tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update relevant tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view tickets for accessible organizations" ON support_tickets;

CREATE POLICY "Users can view accessible tickets"
  ON support_tickets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = support_tickets.organization_id
    )
    OR assigned_to = (select auth.uid())
    OR created_by = (select auth.uid())
  );

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organization_id
    )
  );

CREATE POLICY "Users can update accessible tickets"
  ON support_tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR assigned_to = (select auth.uid())
    OR created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = support_tickets.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR assigned_to = (select auth.uid())
    OR created_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = (select auth.uid())
      AND uoa.organization_id = organization_id
    )
  );

CREATE POLICY "Internal users can delete tickets"
  ON support_tickets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- TICKET_MESSAGES TABLE
-- =============================================
DROP POLICY IF EXISTS "Internal users can delete messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can delete their messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can read ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can update their messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can view messages for accessible tickets" ON ticket_messages;

CREATE POLICY "Users can view ticket messages"
  ON ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = (select auth.uid())
          AND user_roles.is_internal = true
        )
        OR st.assigned_to = (select auth.uid())
        OR st.created_by = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_organization_assignments uoa
          WHERE uoa.user_id = (select auth.uid())
          AND uoa.organization_id = st.organization_id
        )
      )
    )
  );

CREATE POLICY "Users can create ticket messages"
  ON ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
      AND (
        EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = (select auth.uid())
          AND user_roles.is_internal = true
        )
        OR st.assigned_to = (select auth.uid())
        OR st.created_by = (select auth.uid())
        OR EXISTS (
          SELECT 1 FROM user_organization_assignments uoa
          WHERE uoa.user_id = (select auth.uid())
          AND uoa.organization_id = st.organization_id
        )
      )
    )
  );

CREATE POLICY "Users can update own messages"
  ON ticket_messages FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own messages"
  ON ticket_messages FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- COMPLIANCE_EVENTS TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete compliance events" ON compliance_events;
DROP POLICY IF EXISTS "Internal users can delete compliance events" ON compliance_events;
DROP POLICY IF EXISTS "Staff can create compliance events" ON compliance_events;
DROP POLICY IF EXISTS "Staff can update compliance events" ON compliance_events;
DROP POLICY IF EXISTS "Users can insert compliance events in accessible facilities" ON compliance_events;
DROP POLICY IF EXISTS "Users can read compliance events for their sites" ON compliance_events;
DROP POLICY IF EXISTS "Users can update compliance events in accessible facilities" ON compliance_events;
DROP POLICY IF EXISTS "Users can view compliance events in accessible facilities" ON compliance_events;

CREATE POLICY "Users can view compliance events"
  ON compliance_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = compliance_events.site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create compliance events"
  ON compliance_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update compliance events"
  ON compliance_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = compliance_events.site_id
      AND uoa.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete compliance events"
  ON compliance_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );

-- =============================================
-- DEFICIENCIES TABLE
-- =============================================
DROP POLICY IF EXISTS "Admins can delete deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Internal users can delete deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Staff can create deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Staff can update deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Users can insert deficiencies in accessible facilities" ON deficiencies;
DROP POLICY IF EXISTS "Users can read deficiencies for their sites" ON deficiencies;
DROP POLICY IF EXISTS "Users can update deficiencies in accessible facilities" ON deficiencies;
DROP POLICY IF EXISTS "Users can view deficiencies in accessible facilities" ON deficiencies;

CREATE POLICY "Users can view deficiencies"
  ON deficiencies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = deficiencies.site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create deficiencies"
  ON deficiencies FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update deficiencies"
  ON deficiencies FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = deficiencies.site_id
      AND uoa.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
    OR EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
      WHERE f.id = site_id
      AND uoa.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Internal users can delete deficiencies"
  ON deficiencies FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.is_internal = true
    )
  );
