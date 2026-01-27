/*
  # Recreate Admin User with Complete Schema

  1. Summary
    Removes and recreates the admin user with all required auth.users columns properly set.
    This ensures full compatibility with Supabase authentication flow.

  2. Changes Made
    - Deletes existing admin user (if any)
    - Creates new admin user with all required auth columns
    - Properly handles NULL values for all optional fields

  3. User Details
    - Email: jeff.lutz@proximitylabservices.com
    - Password: ProximityAdmin2024!
    - Role: Proximity Admin (via trigger)

  4. Security
    - Email is marked as confirmed
    - Password is properly encrypted with bcrypt
*/

-- First, clean up any existing user and related records
DO $$
DECLARE
  existing_user_id uuid;
BEGIN
  -- Get existing user ID
  SELECT id INTO existing_user_id FROM auth.users WHERE email = 'jeff.lutz@proximitylabservices.com';
  
  IF existing_user_id IS NOT NULL THEN
    -- Delete related records first
    DELETE FROM public.user_roles WHERE user_id = existing_user_id;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = existing_user_id;
  END IF;
END $$;

-- Now create the user with all required columns
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'jeff.lutz@proximitylabservices.com',
  crypt('ProximityAdmin2024!', gen_salt('bf')),
  now(),
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Jeff Lutz"}'::jsonb,
  NULL,
  now(),
  now(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  '',
  NULL,
  false,
  NULL
);
