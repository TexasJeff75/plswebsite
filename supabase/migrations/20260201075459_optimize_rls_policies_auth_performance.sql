/*
  # Optimize RLS Policies for Auth Function Performance

  ## Overview
  Optimizes RLS policies by replacing direct auth function calls with subquery pattern.
  This prevents re-evaluation of auth functions for each row, dramatically improving query performance at scale.

  ## Changes Made

  ### Pattern Applied
  - Replace `auth.uid()` with `(select auth.uid())`
  - Replace `is_internal_user(auth.uid())` with `is_internal_user((select auth.uid()))`
  - Replace `user_can_access_organization(auth.uid(), ...)` with `user_can_access_organization((select auth.uid()), ...)`

  ### Tables Updated
  1. support_tickets - 4 policies optimized
  2. ticket_messages - 4 policies optimized
  3. equipment_catalog_documents - 3 policies optimized
  4. unified_documents - 4 policies optimized

  ## Performance Impact
  - Auth functions evaluated once per query instead of per row
  - Can improve query performance by 10-100x on large result sets
  - Reduces database load significantly at scale
*/

-- ============================================================================
-- SUPPORT TICKETS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their tickets or org tickets" ON support_tickets;
CREATE POLICY "Users can view their tickets or org tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid()) 
    OR assigned_to = (select auth.uid()) 
    OR is_internal_user((select auth.uid())) 
    OR user_can_access_organization((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "Users can create tickets for accessible organizations" ON support_tickets;
CREATE POLICY "Users can create tickets for accessible organizations"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) 
    AND (
      is_internal_user((select auth.uid())) 
      OR user_can_access_organization((select auth.uid()), organization_id) 
      OR organization_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update tickets they're involved with" ON support_tickets;
CREATE POLICY "Users can update tickets they're involved with"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    created_by = (select auth.uid()) 
    OR assigned_to = (select auth.uid()) 
    OR is_internal_user((select auth.uid())) 
    OR user_can_access_organization((select auth.uid()), organization_id)
  )
  WITH CHECK (
    created_by = (select auth.uid()) 
    OR assigned_to = (select auth.uid()) 
    OR is_internal_user((select auth.uid())) 
    OR user_can_access_organization((select auth.uid()), organization_id)
  );

DROP POLICY IF EXISTS "Internal users can delete tickets" ON support_tickets;
CREATE POLICY "Internal users can delete tickets"
  ON support_tickets
  FOR DELETE
  TO authenticated
  USING (is_internal_user((select auth.uid())));

-- ============================================================================
-- TICKET MESSAGES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view messages for accessible tickets" ON ticket_messages;
CREATE POLICY "Users can view messages for accessible tickets"
  ON ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.created_by = (select auth.uid())
        OR st.assigned_to = (select auth.uid())
        OR is_internal_user((select auth.uid()))
        OR user_can_access_organization((select auth.uid()), st.organization_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can create messages for accessible tickets" ON ticket_messages;
CREATE POLICY "Users can create messages for accessible tickets"
  ON ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_messages.ticket_id
      AND (
        st.created_by = (select auth.uid())
        OR st.assigned_to = (select auth.uid())
        OR is_internal_user((select auth.uid()))
        OR user_can_access_organization((select auth.uid()), st.organization_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON ticket_messages;
CREATE POLICY "Users can update own messages"
  ON ticket_messages
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (select auth.uid()) 
    OR is_internal_user((select auth.uid()))
  )
  WITH CHECK (
    user_id = (select auth.uid()) 
    OR is_internal_user((select auth.uid()))
  );

DROP POLICY IF EXISTS "Internal users can delete messages" ON ticket_messages;
CREATE POLICY "Internal users can delete messages"
  ON ticket_messages
  FOR DELETE
  TO authenticated
  USING (is_internal_user((select auth.uid())));

-- ============================================================================
-- EQUIPMENT CATALOG DOCUMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Proximity staff can insert equipment catalog documents" ON equipment_catalog_documents;
CREATE POLICY "Proximity staff can insert equipment catalog documents"
  ON equipment_catalog_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

DROP POLICY IF EXISTS "Proximity staff can update equipment catalog documents" ON equipment_catalog_documents;
CREATE POLICY "Proximity staff can update equipment catalog documents"
  ON equipment_catalog_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

DROP POLICY IF EXISTS "Proximity admin can delete equipment catalog documents" ON equipment_catalog_documents;
CREATE POLICY "Proximity admin can delete equipment catalog documents"
  ON equipment_catalog_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- ============================================================================
-- UNIFIED DOCUMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible documents" ON unified_documents;
CREATE POLICY "Users can view accessible documents"
  ON unified_documents
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role IN ('Proximity Admin', 'System Admin')
      ) THEN true
      WHEN entity_type = 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        WHERE f.id = unified_documents.entity_id
        AND uoa.user_id = (select auth.uid())
      )
      WHEN entity_type = 'equipment_catalog' THEN true
      WHEN entity_type = 'organization' THEN EXISTS (
        SELECT 1 FROM user_organization_assignments uoa
        WHERE uoa.organization_id = unified_documents.entity_id
        AND uoa.user_id = (select auth.uid())
      )
      WHEN entity_type = 'user' THEN entity_id = (select auth.uid())
      ELSE false
    END
  );

DROP POLICY IF EXISTS "Users can insert documents for accessible entities" ON unified_documents;
CREATE POLICY "Users can insert documents for accessible entities"
  ON unified_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE entity_type
      WHEN 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        WHERE f.id = unified_documents.entity_id
        AND uoa.user_id = (select auth.uid())
      )
      WHEN 'equipment_catalog' THEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
      )
      WHEN 'organization' THEN EXISTS (
        SELECT 1 FROM user_organization_assignments uoa
        WHERE uoa.organization_id = unified_documents.entity_id
        AND uoa.user_id = (select auth.uid())
      )
      WHEN 'user' THEN entity_id = (select auth.uid())
      ELSE EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = (select auth.uid())
        AND user_roles.role IN ('Proximity Admin', 'System Admin')
      )
    END
  );

DROP POLICY IF EXISTS "Users can update documents they uploaded or have admin rights" ON unified_documents;
CREATE POLICY "Users can update documents they uploaded or have admin rights"
  ON unified_documents
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role IN ('Proximity Admin', 'System Admin')
    )
  );

DROP POLICY IF EXISTS "Admins and uploaders can delete documents" ON unified_documents;
CREATE POLICY "Admins and uploaders can delete documents"
  ON unified_documents
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (select auth.uid())
      AND user_roles.role IN ('Proximity Admin', 'System Admin')
    )
  );
