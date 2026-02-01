/*
  # Fix Milestones INSERT Policy - Consolidate Conflicting Policies

  1. Changes
    - Remove the "Staff can modify milestones" FOR ALL policy (too broad)
    - Keep specific INSERT, UPDATE, DELETE, SELECT policies with proper logic
    - Allow inserts for internal users OR users with org assignments
  
  2. Security
    - Internal users (Proximity staff) can insert/update/delete milestones
    - Users with organization assignments can insert/update milestones for their facilities
    - All authenticated users can view milestones for their accessible facilities
*/

-- Drop the broad "Staff can modify milestones" policy
DROP POLICY IF EXISTS "Staff can modify milestones" ON milestones;

-- The specific policies already exist and have the correct logic:
-- "Users can view milestones" (SELECT)
-- "Users can insert milestones" (INSERT) 
-- "Users can update milestones" (UPDATE)
-- "Internal users can delete milestones" (DELETE)

-- These policies allow:
-- - Internal users (is_internal = true) to do everything
-- - Users with org assignments to insert/update for their facilities
-- - All users to view milestones for their accessible facilities