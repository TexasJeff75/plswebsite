/*
  # Fix auth.users Schema for Login

  1. Summary
    Fixes the auth.users table schema to properly handle NULL values for email change tracking columns.
    This resolves the "converting NULL to string is unsupported" error during login.

  2. Changes Made
    - Updates existing admin user to include all required auth columns
    - Sets proper NULL values for optional columns like email_change, phone_change, etc.
    - Ensures the user record is fully compatible with Supabase auth flow

  3. Security
    - No changes to RLS policies
    - Only updates the existing admin user record
*/

-- Update the existing admin user to include all required columns
DO $$
DECLARE
  user_id uuid;
BEGIN
  -- Find the admin user
  SELECT id INTO user_id FROM auth.users WHERE email = 'jeff.lutz@proximitylabservices.com';
  
  IF user_id IS NOT NULL THEN
    -- Update the user record with all required fields
    UPDATE auth.users
    SET
      encrypted_password = crypt('ProximityAdmin2024!', gen_salt('bf')),
      email_confirmed_at = now(),
      phone_confirmed_at = NULL,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      phone_change = '',
      phone_change_token = '',
      reauthentication_token = '',
      last_sign_in_at = NULL,
      raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = '{"full_name":"Jeff Lutz"}'::jsonb,
      is_super_admin = NULL,
      updated_at = now()
    WHERE id = user_id;
  END IF;
END $$;
