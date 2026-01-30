/*
  # Fix Support Tickets RLS Access

  1. Summary
    Fixes RLS policies for support_tickets and ticket_messages to allow authenticated users
    to access tickets they created or are involved with.

  2. Changes
    - Updates support_tickets SELECT policy to allow users to view tickets they created
    - Updates support_tickets UPDATE policy to allow users to update tickets they're involved with
    - Simplifies ticket_messages policies to work with the new logic

  3. Security
    - Users can view tickets they created
    - Users can view tickets assigned to them
    - Internal users can still view all tickets for accessible organizations
    - Messages follow ticket access permissions
*/

-- Drop and recreate support_tickets policies
DROP POLICY IF EXISTS "Users can view tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can update accessible tickets" ON support_tickets;
DROP POLICY IF EXISTS "Internal users can delete tickets" ON support_tickets;

-- Allow users to view tickets they created, are assigned to, or have org access to
CREATE POLICY "Users can view their tickets or accessible org tickets" ON support_tickets
  FOR SELECT USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

-- Allow users to create tickets for accessible organizations
CREATE POLICY "Users can create tickets for accessible organizations" ON support_tickets
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND (
      is_internal_user(auth.uid())
      OR user_can_access_organization(auth.uid(), organization_id)
      OR organization_id IS NULL
    )
  );

-- Allow users to update tickets they're involved with or have access to
CREATE POLICY "Users can update tickets they're involved with" ON support_tickets
  FOR UPDATE USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  ) WITH CHECK (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

-- Internal users can delete tickets
CREATE POLICY "Internal users can delete tickets" ON support_tickets
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Drop and recreate ticket_messages policies
DROP POLICY IF EXISTS "Users can view messages for accessible tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create messages for accessible tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON ticket_messages;
DROP POLICY IF EXISTS "Internal users can delete messages" ON ticket_messages;

-- Allow users to view messages for tickets they can access
CREATE POLICY "Users can view messages for accessible tickets" ON ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.created_by = auth.uid()
        OR st.assigned_to = auth.uid()
        OR is_internal_user(auth.uid())
        OR user_can_access_organization(auth.uid(), st.organization_id)
      )
    )
  );

-- Allow users to create messages for tickets they can access
CREATE POLICY "Users can create messages for accessible tickets" ON ticket_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.created_by = auth.uid()
        OR st.assigned_to = auth.uid()
        OR is_internal_user(auth.uid())
        OR user_can_access_organization(auth.uid(), st.organization_id)
      )
    )
  );

-- Allow users to update their own messages
CREATE POLICY "Users can update own messages" ON ticket_messages
  FOR UPDATE USING (
    user_id = auth.uid()
    OR is_internal_user(auth.uid())
  ) WITH CHECK (
    user_id = auth.uid()
    OR is_internal_user(auth.uid())
  );

-- Internal users can delete messages
CREATE POLICY "Internal users can delete messages" ON ticket_messages
  FOR DELETE USING (is_internal_user(auth.uid()));