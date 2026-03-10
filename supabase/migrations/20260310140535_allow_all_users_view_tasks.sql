/*
  # Allow All Users to View Tasks

  1. Changes
    - Update SELECT policy on milestone_tasks to allow all authenticated users to view tasks
    - Keeps other policies (INSERT, UPDATE, DELETE) restricted to appropriate roles

  2. Security
    - All authenticated users can view all tasks (read-only)
    - Only admins, staff, and assigned users can modify tasks
    - Only creators and admins can delete tasks
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view tasks for accessible facilities" ON milestone_tasks;

-- Allow all authenticated users to view tasks
CREATE POLICY "All users can view tasks"
  ON milestone_tasks FOR SELECT
  TO authenticated
  USING (true);
