/*
  # StratusDX Normalized Relationship Tables

  ## Overview
  Parses the raw JSON from the StratusDX API (order_data, result_data)
  into proper relational tables so every field is queryable, filterable,
  and displayable without parsing JSON at runtime.

  ## New Tables

  ### 1. stratus_order_panels
  One row per panel within a lab order. Links to lab_orders.
  Columns: panel_name, panel_code, cpt_code, testmethod_code, testmethod_name,
  rapid_order, sample_type, specimen_type, interface_code, orderset_name,
  orderset_billing_code, alt_panel_name, panel_notes, runby, runby_datetime,
  comments, sort_order.

  ### 2. stratus_order_tests
  Individual tests within a panel (nested under panels in the API).
  Links to stratus_order_panels and lab_orders.
  Columns: test_code, test_name, loinc_code, loinc_text, cpt_code, test_uom,
  test_description, test_notes, sort_order.

  ### 3. stratus_order_diagnosis_codes
  ICD diagnosis codes attached to an order.
  Columns: code, name, sort_order.

  ### 4. stratus_order_medications
  Medications listed on an order.
  Columns: code, name, sort_order.

  ### 5. stratus_order_insurance
  Insurance records (primary + secondary) for an order.
  Columns: insurance_type (primary/secondary), all insurance fields from API.

  ### 6. stratus_result_observations
  Individual test results/observations within a result's panel.
  Links to lab_results and stratus_order_panels.
  Columns: test_code, test_name, loinc_code, loinc_text, result_value,
  result_display, result_flag, result_uom, result_comments, result_cutoffvalue,
  result_medication, specimen_requirement, cpt_code, test_notes, sort_order.

  ## Security
  All tables inherit the same RLS pattern as lab_orders/lab_results:
  - proximity_admin / proximity_staff (is_internal_user) have full access
  - customer_admins can manage their organization's rows
  - users can view their organization's rows
  Foreign keys link to lab_orders / lab_results with CASCADE delete.
*/

-- ============================================================
-- 1. stratus_order_panels
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_order_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  panel_name text,
  panel_code text,
  cpt_code text,
  testmethod_code text,
  testmethod_name text,
  rapid_order text,
  sample_type text,
  specimen_type text,
  interface_code text,
  interface_text text,
  orderset_name text,
  orderset_billing_code text,
  alt_panel_name text,
  panel_notes text,
  runby text,
  runby_datetime text,
  comments text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_order_panels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all order panels" ON stratus_order_panels;
CREATE POLICY "Admins can manage all order panels"
  ON stratus_order_panels FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_panels.lab_order_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_panels.lab_order_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org order panels" ON stratus_order_panels;
CREATE POLICY "Customer admins can manage their org order panels"
  ON stratus_order_panels FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_panels.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_panels.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org order panels" ON stratus_order_panels;
CREATE POLICY "Users can view their org order panels"
  ON stratus_order_panels FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_orders
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
      WHERE lab_orders.id = stratus_order_panels.lab_order_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_order_panels_order_id ON stratus_order_panels(lab_order_id);

-- ============================================================
-- 2. stratus_order_tests
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_order_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  order_panel_id uuid REFERENCES stratus_order_panels(id) ON DELETE CASCADE,
  test_code text,
  test_name text,
  loinc_code text,
  loinc_text text,
  cpt_code text,
  test_uom text,
  test_description text,
  test_notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_order_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all order tests" ON stratus_order_tests;
CREATE POLICY "Admins can manage all order tests"
  ON stratus_order_tests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_tests.lab_order_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_tests.lab_order_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org order tests" ON stratus_order_tests;
CREATE POLICY "Customer admins can manage their org order tests"
  ON stratus_order_tests FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_tests.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_tests.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org order tests" ON stratus_order_tests;
CREATE POLICY "Users can view their org order tests"
  ON stratus_order_tests FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_orders
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
      WHERE lab_orders.id = stratus_order_tests.lab_order_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_order_tests_order_id ON stratus_order_tests(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_stratus_order_tests_panel_id ON stratus_order_tests(order_panel_id);

-- ============================================================
-- 3. stratus_order_diagnosis_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_order_diagnosis_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  code text,
  name text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_order_diagnosis_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all order dx codes" ON stratus_order_diagnosis_codes;
CREATE POLICY "Admins can manage all order dx codes"
  ON stratus_order_diagnosis_codes FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_diagnosis_codes.lab_order_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_diagnosis_codes.lab_order_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org dx codes" ON stratus_order_diagnosis_codes;
CREATE POLICY "Customer admins can manage their org dx codes"
  ON stratus_order_diagnosis_codes FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_diagnosis_codes.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_diagnosis_codes.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org dx codes" ON stratus_order_diagnosis_codes;
CREATE POLICY "Users can view their org dx codes"
  ON stratus_order_diagnosis_codes FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_orders
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
      WHERE lab_orders.id = stratus_order_diagnosis_codes.lab_order_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_order_dx_order_id ON stratus_order_diagnosis_codes(lab_order_id);

-- ============================================================
-- 4. stratus_order_medications
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_order_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  code text,
  name text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_order_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all order meds" ON stratus_order_medications;
CREATE POLICY "Admins can manage all order meds"
  ON stratus_order_medications FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_medications.lab_order_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_medications.lab_order_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org meds" ON stratus_order_medications;
CREATE POLICY "Customer admins can manage their org meds"
  ON stratus_order_medications FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_medications.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_medications.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org meds" ON stratus_order_medications;
CREATE POLICY "Users can view their org meds"
  ON stratus_order_medications FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_orders
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
      WHERE lab_orders.id = stratus_order_medications.lab_order_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_order_meds_order_id ON stratus_order_medications(lab_order_id);

-- ============================================================
-- 5. stratus_order_insurance
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_order_insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id uuid NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  insurance_type text NOT NULL DEFAULT 'primary',
  -- insurance fields from API (flexible - may vary)
  policy_number text,
  group_number text,
  plan_name text,
  insured_name text,
  insured_id text,
  insured_dob text,
  insured_relationship text,
  insured_address text,
  insured_city text,
  insured_state text,
  insured_zip text,
  insured_phone text,
  payer_id text,
  payer_name text,
  payer_address text,
  payer_city text,
  payer_state text,
  payer_zip text,
  payer_phone text,
  copay text,
  deductible text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_order_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all order insurance" ON stratus_order_insurance;
CREATE POLICY "Admins can manage all order insurance"
  ON stratus_order_insurance FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_insurance.lab_order_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    WHERE lab_orders.id = stratus_order_insurance.lab_order_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org insurance" ON stratus_order_insurance;
CREATE POLICY "Customer admins can manage their org insurance"
  ON stratus_order_insurance FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_insurance.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_orders
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_orders.id = stratus_order_insurance.lab_order_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org insurance" ON stratus_order_insurance;
CREATE POLICY "Users can view their org insurance"
  ON stratus_order_insurance FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_orders
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_orders.organization_id
      WHERE lab_orders.id = stratus_order_insurance.lab_order_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_order_insurance_order_id ON stratus_order_insurance(lab_order_id);

-- ============================================================
-- 6. stratus_result_observations
-- ============================================================
CREATE TABLE IF NOT EXISTS stratus_result_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_result_id uuid NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
  lab_order_id uuid REFERENCES lab_orders(id) ON DELETE CASCADE,
  order_panel_id uuid REFERENCES stratus_order_panels(id) ON DELETE SET NULL,
  test_code text,
  test_name text,
  loinc_code text,
  loinc_text text,
  result_value text,
  result_display text,
  result_flag text,
  result_uom text,
  result_comments text,
  result_cutoffvalue text,
  result_medication text,
  specimen_requirement text,
  cpt_code text,
  test_uom text,
  test_description text,
  test_notes text,
  is_abnormal boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stratus_result_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all result observations" ON stratus_result_observations;
CREATE POLICY "Admins can manage all result observations"
  ON stratus_result_observations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_results
    WHERE lab_results.id = stratus_result_observations.lab_result_id
    AND is_internal_user() = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_results
    WHERE lab_results.id = stratus_result_observations.lab_result_id
    AND is_internal_user() = true
  ));

DROP POLICY IF EXISTS "Customer admins can manage their org result obs" ON stratus_result_observations;
CREATE POLICY "Customer admins can manage their org result obs"
  ON stratus_result_observations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM lab_results
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_results.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_results.id = stratus_result_observations.lab_result_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM lab_results
    JOIN user_organization_assignments uoa ON uoa.organization_id = lab_results.organization_id
    JOIN user_roles ur ON ur.user_id = uoa.user_id
    WHERE lab_results.id = stratus_result_observations.lab_result_id
    AND uoa.user_id = auth.uid()
    AND ur.role = 'Customer Admin'
  ));

DROP POLICY IF EXISTS "Users can view their org result obs" ON stratus_result_observations;
CREATE POLICY "Users can view their org result obs"
  ON stratus_result_observations FOR SELECT
  TO authenticated
  USING (
    is_internal_user() = true
    OR EXISTS (
      SELECT 1 FROM lab_results
      JOIN user_organization_assignments uoa ON uoa.organization_id = lab_results.organization_id
      WHERE lab_results.id = stratus_result_observations.lab_result_id
      AND uoa.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_stratus_result_obs_result_id ON stratus_result_observations(lab_result_id);
CREATE INDEX IF NOT EXISTS idx_stratus_result_obs_order_id ON stratus_result_observations(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_stratus_result_obs_panel_id ON stratus_result_observations(order_panel_id);
CREATE INDEX IF NOT EXISTS idx_stratus_result_obs_abnormal ON stratus_result_observations(is_abnormal) WHERE is_abnormal = true;

-- ============================================================
-- 7. Add patient/provider/org columns to lab_orders for direct queryability
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_first_name') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_first_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_last_name') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_last_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_dob') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_dob text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_gender') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_gender text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_id') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_phone_home') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_phone_home text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_phone_mobile') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_phone_mobile text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_phone_office') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_phone_office text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_email') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_address') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_city') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_state') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'patient_zip') THEN
    ALTER TABLE lab_orders ADD COLUMN patient_zip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'provider_first_name') THEN
    ALTER TABLE lab_orders ADD COLUMN provider_first_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'provider_last_name') THEN
    ALTER TABLE lab_orders ADD COLUMN provider_last_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'provider_npi') THEN
    ALTER TABLE lab_orders ADD COLUMN provider_npi text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_name') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_phone') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_clia') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_clia text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_address') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_city') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_state') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'lab_zip') THEN
    ALTER TABLE lab_orders ADD COLUMN lab_zip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'collected_datetime') THEN
    ALTER TABLE lab_orders ADD COLUMN collected_datetime text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'requisition_datetime') THEN
    ALTER TABLE lab_orders ADD COLUMN requisition_datetime text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'received_datetime') THEN
    ALTER TABLE lab_orders ADD COLUMN received_datetime text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'finalized_datetime') THEN
    ALTER TABLE lab_orders ADD COLUMN finalized_datetime text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'requisition_by') THEN
    ALTER TABLE lab_orders ADD COLUMN requisition_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'order_comments') THEN
    ALTER TABLE lab_orders ADD COLUMN order_comments text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lab_orders' AND column_name = 'custom_fields') THEN
    ALTER TABLE lab_orders ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_name ON lab_orders(patient_last_name, patient_first_name);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_dob ON lab_orders(patient_dob);
CREATE INDEX IF NOT EXISTS idx_lab_orders_provider_npi ON lab_orders(provider_npi);
