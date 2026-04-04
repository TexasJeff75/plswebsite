/*
  # Add foreign key from courier_facility_assignments to user_roles

  ## Summary
  Adds a foreign key relationship from courier_facility_assignments.courier_user_id
  to user_roles.user_id to enable Supabase join queries.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_courier_assignments_user_roles'
  ) THEN
    ALTER TABLE courier_facility_assignments
      ADD CONSTRAINT fk_courier_assignments_user_roles
      FOREIGN KEY (courier_user_id) REFERENCES user_roles(user_id) ON DELETE CASCADE;
  END IF;
END $$;
