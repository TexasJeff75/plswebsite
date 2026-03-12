/*
  # Apply Pending Invitation on Login

  ## Problem
  The handle_new_user() trigger only fires on INSERT into auth.users (first signup).
  If a user's invitation expired before they first signed in, they get a default
  'Customer Viewer' role with NO organization assignments. Even after clearing the
  expired invite and creating a new one, the trigger won't fire again because the
  user already exists in auth.users. The user is locked out of the deployment tracker.

  ## Solution
  1. Create an apply_pending_invitation() function that existing users can call on
     login to pick up any pending invitation for their email.
  2. Also fix the resend flow to allow resending expired invitations (not just pending).
*/

-- Function for existing users to apply a pending invitation on login
CREATE OR REPLACE FUNCTION apply_pending_invitation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  current_email text;
  invitation_record RECORD;
  org_assignment JSONB;
  user_role TEXT;
  user_is_internal BOOLEAN;
  user_display_name TEXT;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'not_authenticated');
  END IF;

  -- Get the user's email from auth.users
  SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
  IF current_email IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_email');
  END IF;

  -- Check for a pending, non-expired invitation for this email
  SELECT * INTO invitation_record
  FROM user_invitations
  WHERE email = current_email
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  -- No pending invitation found
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'no_pending_invitation');
  END IF;

  -- Apply the invitation
  user_role := invitation_record.role;
  user_is_internal := invitation_record.role IN (
    'Proximity Admin', 'Proximity Staff', 'Account Manager',
    'Technical Consultant', 'Compliance Specialist'
  );

  -- Get display name
  SELECT COALESCE(raw_user_meta_data->>'full_name', current_email)
  INTO user_display_name
  FROM auth.users
  WHERE id = current_user_id;

  -- Update user role
  INSERT INTO user_roles (user_id, email, display_name, role, is_internal)
  VALUES (current_user_id, current_email, user_display_name, user_role, user_is_internal)
  ON CONFLICT (user_id) DO UPDATE
  SET role = EXCLUDED.role,
      is_internal = EXCLUDED.is_internal,
      display_name = EXCLUDED.display_name,
      updated_at = now();

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
        current_user_id,
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

  RETURN jsonb_build_object(
    'applied', true,
    'role', user_role,
    'invitation_id', invitation_record.id
  );
END;
$$;
