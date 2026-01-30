/*
  # Cleanup Duplicate Support Tickets Policies

  1. Summary
    Removes duplicate and conflicting RLS policies on support_tickets table

  2. Changes
    - Drops all existing policies on support_tickets
    - Recreates only the correct, simplified policies
    - Ensures users can view tickets they created or are assigned to

  3. Security
    - Users can view tickets they created
    - Users can view tickets assigned to them
    - Internal users can view all accessible tickets
    - Maintains existing INSERT, UPDATE, DELETE policies
*/

-- Drop ALL existing policies on support_tickets
DROP POLICY IF EXISTS "Users can view accessible tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view their tickets or accessible org tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets for accessible organizations" ON support_tickets;
DROP POLICY IF EXISTS "Users can update accessible tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update tickets they're involved with" ON support_tickets;
DROP POLICY IF EXISTS "Internal users can delete tickets" ON support_tickets;

-- Recreate SELECT policy (simplified, covers all cases)
CREATE POLICY "Users can view their tickets or org tickets" ON support_tickets
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

-- Recreate INSERT policy
CREATE POLICY "Users can create tickets for accessible organizations" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_internal_user(auth.uid())
      OR user_can_access_organization(auth.uid(), organization_id)
      OR organization_id IS NULL
    )
  );

-- Recreate UPDATE policy
CREATE POLICY "Users can update tickets they're involved with" ON support_tickets
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR is_internal_user(auth.uid())
    OR user_can_access_organization(auth.uid(), organization_id)
  );

-- Recreate DELETE policy
CREATE POLICY "Internal users can delete tickets" ON support_tickets
  FOR DELETE TO authenticated
  USING (is_internal_user(auth.uid()));