/*
  # Fix Deployments RLS Policies

  1. Security
    - Replace overly permissive policies with restrictive ones
    - Public read access with USING (true) is removed
    - Only authenticated users can read/write deployments
    - SELECT: All authenticated users can read (viewable deployment info)
    - INSERT: Authenticated users can create new deployments
    - UPDATE: Authenticated users can update any deployment
    - DELETE: Authenticated users can delete any deployment
*/

DROP POLICY IF EXISTS "Allow public read access to deployments" ON deployments;
DROP POLICY IF EXISTS "Allow authenticated users to insert deployments" ON deployments;
DROP POLICY IF EXISTS "Allow authenticated users to update deployments" ON deployments;
DROP POLICY IF EXISTS "Allow authenticated users to delete deployments" ON deployments;

CREATE POLICY "Authenticated users can read deployments"
  ON deployments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deployments"
  ON deployments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update deployments"
  ON deployments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deployments"
  ON deployments FOR DELETE
  TO authenticated
  USING (true);
