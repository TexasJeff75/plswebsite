/*
  # Fix handle_new_user Trigger Function

  1. Summary
    Updates the handle_new_user trigger function to work with the new consolidated role system
    that no longer uses the user_type column.

  2. Changes
    - Removes reference to user_type column (which was dropped)
    - Updates to use 'Proximity Admin' role for jeff.lutz@proximitylabservices.com
    - Updates default role to 'Customer Viewer' for other users

  3. Notes
    - This fixes the trigger so new users can be created without errors
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin user
  IF NEW.email = 'jeff.lutz@proximitylabservices.com' THEN
    INSERT INTO public.user_roles (user_id, email, display_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Proximity Admin'
    );
  ELSE
    -- Default to Customer Viewer
    INSERT INTO public.user_roles (user_id, email, display_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Customer Viewer'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
