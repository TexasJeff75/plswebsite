/*
  # Create Admin User: jeff.lutz@proximitylabservices.com

  1. Summary
    Creates the initial admin user account for Jeff Lutz with full system access.

  2. New User Details
    - Email: jeff.lutz@proximitylabservices.com
    - Role: Proximity Admin (auto-assigned via trigger)
    - Full name: Jeff Lutz
    - Temporary password: ProximityAdmin2024!

  3. Security
    - User will be automatically assigned the 'Proximity Admin' role via the handle_new_user trigger
    - No organization_id (admins can access all organizations)
    - Email will be marked as confirmed for immediate access

  4. Important
    - The user should change their password after first login
    - Login credentials:
      * Email: jeff.lutz@proximitylabservices.com
      * Password: ProximityAdmin2024!
*/

-- Create the admin user in auth.users
DO $$
BEGIN
  -- Check if user already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'jeff.lutz@proximitylabservices.com') THEN
    -- Insert user into auth.users (trigger will create user_roles entry)
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token,
      recovery_token
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'jeff.lutz@proximitylabservices.com',
      crypt('ProximityAdmin2024!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Jeff Lutz"}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated',
      '',
      ''
    );
  END IF;
END $$;
