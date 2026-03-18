
/*
  # Deduplicate Commission Periods & Add Unique Constraint

  ## Summary
  - Keeps exactly one commission period per calendar month (the earliest created one)
  - Reassigns all qbo_invoices that reference duplicate periods to the surviving period
  - Adds a UNIQUE constraint on start_date so duplicates can never be created again

  ## Changes
  1. For each month, pick the oldest period as the canonical one
  2. Update qbo_invoices.commission_period_id to point to the canonical period
  3. Delete all duplicate periods
  4. Add UNIQUE constraint on commission_periods.start_date
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      start_date,
      MIN(created_at) AS keep_created_at
    FROM commission_periods
    GROUP BY start_date
    HAVING COUNT(*) > 1
  LOOP
    DECLARE
      keep_id uuid;
    BEGIN
      SELECT id INTO keep_id
      FROM commission_periods
      WHERE start_date = r.start_date
      ORDER BY created_at ASC
      LIMIT 1;

      UPDATE qbo_invoices
      SET commission_period_id = keep_id
      WHERE commission_period_id IN (
        SELECT id FROM commission_periods
        WHERE start_date = r.start_date AND id <> keep_id
      );

      DELETE FROM commission_periods
      WHERE start_date = r.start_date AND id <> keep_id;
    END;
  END LOOP;
END $$;

ALTER TABLE commission_periods
  ADD CONSTRAINT commission_periods_start_date_unique UNIQUE (start_date);
