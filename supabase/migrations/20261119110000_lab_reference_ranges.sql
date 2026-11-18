/*
  # Lab reference ranges and cut-offs

  StratusDX sends each result's value, a display value, a flag and the unit,
  but no reference ranges or cut-offs. This table holds them, entered once
  per test in Settings > Reference Ranges, so result reports and trend charts
  can draw the normal range or the cut-off.

  - test_name: matched to the result's test name (not case-sensitive)
  - panel_name: optional; set it only when the same test name needs a
    different range in a different panel
  - kind: 'range' (normal low to high) or 'cutoff' (positive at or above)

  Everyone signed in can read them (they appear on result reports);
  only internal staff can add, change or remove them.
*/

CREATE TABLE IF NOT EXISTS lab_reference_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  panel_name text,
  kind text NOT NULL DEFAULT 'range' CHECK (kind IN ('range', 'cutoff')),
  range_low numeric,
  range_high numeric,
  cutoff numeric,
  unit text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_reference_ranges_test_panel
  ON lab_reference_ranges (lower(test_name), coalesce(lower(panel_name), ''));

ALTER TABLE lab_reference_ranges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users can read reference ranges" ON lab_reference_ranges;
CREATE POLICY "Signed-in users can read reference ranges"
  ON lab_reference_ranges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Internal staff can add reference ranges" ON lab_reference_ranges;
CREATE POLICY "Internal staff can add reference ranges"
  ON lab_reference_ranges FOR INSERT TO authenticated WITH CHECK (is_internal_user());

DROP POLICY IF EXISTS "Internal staff can change reference ranges" ON lab_reference_ranges;
CREATE POLICY "Internal staff can change reference ranges"
  ON lab_reference_ranges FOR UPDATE TO authenticated USING (is_internal_user()) WITH CHECK (is_internal_user());

DROP POLICY IF EXISTS "Internal staff can remove reference ranges" ON lab_reference_ranges;
CREATE POLICY "Internal staff can remove reference ranges"
  ON lab_reference_ranges FOR DELETE TO authenticated USING (is_internal_user());
