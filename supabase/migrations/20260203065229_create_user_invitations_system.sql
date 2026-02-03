/*
  # Create User Invitations System

  ## Overview
  Creates a system for admins to invite users by email, preconfigure their permissions,
  and send invitation emails. When users sign in with Microsoft SSO, their preconfigured
  permissions are automatically applied.

  ## New Tables
    
  ### `user_invitations`
  Stores pending user invitations with preconfigured roles and organization assignments.
  
  - `id` (uuid, primary key)
  - `email` (text, unique, not null) - Email address of invitee
  - `role` (text, not null) - Preconfigured role (Proximity Admin, Account Manager, etc.)
  - `invited_by` (uuid, references user_roles.user_id) - Admin who sent the invite
  - `organization_assignments` (jsonb) - Array of org IDs and roles to assign on signup
  - `status` (text, default 'pending') - pending, accepted, expired, cancelled
  - `invitation_token` (uuid, unique) - Secure token for invitation link
  - `expires_at` (timestamptz) - Invitation expiration (default 7 days)
  - `accepted_at` (timestamptz) - When user accepted and signed up
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ## Security
    - Enable RLS on user_invitations
    - Admins can create and manage invitations
    - Account managers can create invitations for their organizations
    - Users can view their own pending invitation (by email or token)

  ## Functions
    - `accept_user_invitation()` - Automatically applies preconfigured permissions when user signs in
*/

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN (
    'Proximity Admin',
    'Proximity Staff', 
    'Account Manager',
    'Customer Admin',
    'Customer User',
    'Viewer'
  )),
  invited_by uuid REFERENCES user_roles(user_id) ON DELETE SET NULL,
  organization_assignments jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  invitation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_invitations

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Account managers can view invitations they created
CREATE POLICY "Account managers can view their invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    is_admin_or_manager(auth.uid())
    AND invited_by = auth.uid()
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Admins and invitation creators can update their invitations
CREATE POLICY "Admins and creators can update invitations"
  ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_user(auth.uid())
    OR invited_by = auth.uid()
  )
  WITH CHECK (
    is_admin_user(auth.uid())
    OR invited_by = auth.uid()
  );

-- Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
  ON user_invitations
  FOR DELETE
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Function to accept invitation and apply permissions
CREATE OR REPLACE FUNCTION accept_user_invitation(user_id_param uuid, user_email_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
  org_assignment JSONB;
BEGIN
  -- Find pending invitation for this email
  SELECT * INTO invitation_record
  FROM user_invitations
  WHERE email = user_email_param
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  -- If invitation found, apply permissions
  IF FOUND THEN
    -- Determine if role is internal
    DECLARE
      is_internal_role BOOLEAN;
    BEGIN
      is_internal_role := invitation_record.role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager');
      
      -- Insert user role
      INSERT INTO user_roles (user_id, email, role, is_internal)
      VALUES (user_id_param, user_email_param, invitation_record.role, is_internal_role)
      ON CONFLICT (user_id) DO UPDATE
      SET role = EXCLUDED.role,
          is_internal = EXCLUDED.is_internal,
          updated_at = now();
    END;

    -- Apply organization assignments
    IF invitation_record.organization_assignments IS NOT NULL THEN
      FOR org_assignment IN SELECT * FROM jsonb_array_elements(invitation_record.organization_assignments)
      LOOP
        INSERT INTO user_organization_assignments (
          user_id,
          organization_id,
          role,
          assigned_by
        )
        VALUES (
          user_id_param,
          (org_assignment->>'organization_id')::uuid,
          org_assignment->>'role',
          invitation_record.invited_by
        )
        ON CONFLICT (user_id, organization_id) DO UPDATE
        SET role = EXCLUDED.role,
            updated_at = now();
      END LOOP;
    END IF;

    -- Mark invitation as accepted
    UPDATE user_invitations
    SET status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    WHERE id = invitation_record.id;
  END IF;
END;
$$;

-- Trigger to automatically apply invitation permissions on user signup
CREATE OR REPLACE FUNCTION handle_new_user_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's a pending invitation for this email
  PERFORM accept_user_invitation(NEW.id, NEW.email);
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created_check_invitation ON auth.users;

CREATE TRIGGER on_auth_user_created_check_invitation
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_invitation();

-- Function to expire old invitations (run periodically)
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;
