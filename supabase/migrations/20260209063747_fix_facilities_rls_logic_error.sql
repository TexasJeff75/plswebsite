/*
  # Fix Facilities RLS Logic Error

  ## Problem
  The current facilities SELECT policy has a logic error that may allow unauthorized access:

  ```sql
  organization_id IS NULL AND is_internal_user(auth.uid())
  OR user_can_access_organization(auth.uid(), organization_id)
  ```

  Due to operator precedence, facilities with NULL organization_id might be visible
  to users based on how `user_can_access_organization` handles NULL values.

  ## Solution
  Add explicit parentheses and NULL handling to ensure:
  1. Only internal users can see facilities with NULL organization_id
  2. Other users can only see facilities in organizations they have access to
  3. No ambiguity in boolean logic

  ## Changes
  - Drop and recreate the SELECT policy on facilities with corrected logic
  - Explicitly handle the NULL organization_id case

  ## Security Impact
  - CRITICAL: Prevents potential unauthorized access to facilities
  - Ensures proper organization-based access control
  - Internal users retain full access
  - Customer users restricted to their assigned organizations only
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view facilities in accessible organizations" ON facilities;

-- Recreate with corrected logic and explicit NULL handling
CREATE POLICY "Users can view facilities in accessible organizations" ON facilities
  FOR SELECT
  TO authenticated
  USING (
    -- Internal users can see all facilities (including those with NULL organization_id)
    is_internal_user(auth.uid())
    OR (
      -- Non-internal users can only see facilities with a valid organization_id
      -- that they have access to
      organization_id IS NOT NULL
      AND user_can_access_organization(auth.uid(), organization_id)
    )
  );
