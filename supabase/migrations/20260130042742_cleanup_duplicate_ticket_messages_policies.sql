/*
  # Clean Up Duplicate Ticket Messages Policies

  1. Changes
    - Remove duplicate RLS policies on ticket_messages table
    - Keep only the consistent, newer policy versions
    - Ensure proper access control for ticket messages

  2. Security
    - Maintains proper RLS enforcement
    - Users can only view/create messages for tickets they have access to
    - Internal users have full access
*/

-- Drop duplicate/old policies
DROP POLICY IF EXISTS "Users can view ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can create ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON ticket_messages;

-- The following policies should remain:
-- 1. "Users can view messages for accessible tickets" (SELECT)
-- 2. "Users can create messages for accessible tickets" (INSERT)
-- 3. "Users can update own messages" (UPDATE)
-- 4. "Internal users can delete messages" (DELETE)
