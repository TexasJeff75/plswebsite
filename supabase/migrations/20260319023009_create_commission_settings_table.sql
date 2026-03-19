/*
  # Create Commission Settings Table

  ## Summary
  Creates a singleton settings table for the commissions module, initially
  used to store CC email addresses that get copied on every commission email.

  ## New Tables
  - `commission_settings`
    - `id` (uuid, primary key) — always a single row
    - `cc_emails` (text[]) — array of email addresses to CC on commission emails
    - `updated_at` (timestamptz) — last updated timestamp
    - `updated_by` (uuid) — user who last updated settings

  ## Security
  - RLS enabled; only Proximity Admin / Proximity Staff may read or write
*/

CREATE TABLE IF NOT EXISTS commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cc_emails text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read commission settings"
  ON commission_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Staff can insert commission settings"
  ON commission_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Staff can update commission settings"
  ON commission_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

INSERT INTO commission_settings (cc_emails) VALUES ('{}');
