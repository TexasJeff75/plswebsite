/*
  # Create Notifications System
  
  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - recipient of the notification
      - `type` (text) - notification category: clia_expiring, pt_due, competency_due, sla_warning, milestone_blocked, ticket_assigned, general
      - `title` (text) - notification title
      - `message` (text) - notification body text
      - `link` (text, nullable) - optional URL to navigate to when clicked
      - `read` (boolean, default false) - whether notification has been read
      - `organization_id` (uuid, nullable) - related organization
      - `facility_id` (uuid, nullable) - related facility
      - `created_at` (timestamptz) - when notification was created
  
  2. Security
    - Enable RLS on `notifications` table
    - Users can only view/update their own notifications
    - Proximity Admin/Staff can create notifications for any user
  
  3. Indexes
    - Index on user_id for fast lookups
    - Index on read status for filtering
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('clia_expiring', 'pt_due', 'competency_due', 'sla_warning', 'milestone_blocked', 'ticket_assigned', 'general')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
    OR auth.uid() = user_id
  );
