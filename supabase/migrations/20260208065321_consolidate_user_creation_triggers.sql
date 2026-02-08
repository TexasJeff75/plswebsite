/*
  # Consolidate User Creation Triggers

  ## Summary
  Fixes "Database error saving new user" by consolidating duplicate triggers that both
  attempt to insert into user_roles table, causing conflicts.

  ## Problem
  Two triggers were running on auth.users INSERT:
  1. handle_new_user() - Creates default user_roles record
  2. handle_new_user_invitation() - Also creates user_roles record if invitation exists

  Both tried to INSERT, causing unique constraint violation on user_id.

  ## Solution
  - Remove separate invitation trigger
  - Consolidate logic into single handle_new_user() function
  - Check for invitation first, then fall back to defaults
  - Use ON CONFLICT to handle edge cases safely

  ## Changes
  1. Drop the separate invitation trigger
  2. Update handle_new_user() to check for invitations first
  3. Ensure only ONE insert happens per user signup
*/

-- Drop the separate invitation trigger
DROP TRIGGER IF EXISTS on_auth_user_created_check_invitation ON auth.users;

-- Consolidate into a single, unified user creation handler
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record RECORD;
  org_assignment JSONB;
  user_role TEXT;
  user_is_internal BOOLEAN;
  user_display_name TEXT;
BEGIN
  -- Get display name from metadata or email
  user_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  -- First, check if there's a pending invitation for this email
  SELECT * INTO invitation_record
  FROM user_invitations
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  -- If invitation exists, use invitation settings
  IF FOUND THEN
    user_role := invitation_record.role;
    user_is_internal := invitation_record.role IN ('Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist');

    -- Insert user role based on invitation
    INSERT INTO user_roles (user_id, email, display_name, role, is_internal)
    VALUES (NEW.id, NEW.email, user_display_name, user_role, user_is_internal)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_internal = EXCLUDED.is_internal,
        display_name = EXCLUDED.display_name,
        updated_at = now();

    -- Apply organization assignments from invitation
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
          NEW.id,
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

  ELSE
    -- No invitation found, use default logic

    -- Special case: jeff.lutz@proximitylabservices.com is always admin
    IF NEW.email = 'jeff.lutz@proximitylabservices.com' THEN
      user_role := 'Proximity Admin';
      user_is_internal := true;
    ELSE
      -- Default to Customer Viewer for other users
      user_role := 'Customer Viewer';
      user_is_internal := false;
    END IF;

    -- Insert user role with defaults
    INSERT INTO user_roles (user_id, email, display_name, role, is_internal)
    VALUES (NEW.id, NEW.email, user_display_name, user_role, user_is_internal)
    ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_internal = EXCLUDED.is_internal,
        display_name = EXCLUDED.display_name,
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (recreate if needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();