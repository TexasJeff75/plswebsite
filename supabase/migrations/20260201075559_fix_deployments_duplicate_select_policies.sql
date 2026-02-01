/*
  # Fix Multiple Permissive Policies on Deployments Table

  ## Overview
  Removes duplicate SELECT policy on deployments table to eliminate security ambiguity.
  The table had two permissive SELECT policies which is redundant.

  ## Changes Made

  ### Removed Policy
  - "Internal users can view deployments" - Redundant restrictive policy

  ### Kept Policy
  - "Authenticated users can read deployments" - General access policy for all authenticated users

  ## Reasoning
  Having two permissive (not restrictive) SELECT policies creates ambiguity.
  Since "Authenticated users can read deployments" already allows all authenticated users access,
  the "Internal users can view deployments" policy is redundant and has been removed.
  
  If deployments should only be visible to internal users, the remaining policy
  should be modified to restrict access appropriately.
*/

-- Drop the redundant SELECT policy
DROP POLICY IF EXISTS "Internal users can view deployments" ON deployments;

-- The "Authenticated users can read deployments" policy remains active
-- and provides SELECT access to all authenticated users
