/*
  # Backfill StratusDX Normalized Tables from Existing JSON

  Parses all existing order_data and result_data JSON blobs into the
  new normalized relationship tables. This is a one-time data migration
  that makes historical records queryable in the new schema.

  ## What it does
  1. Parses lab_orders.order_data into:
     - stratus_order_panels (with nested tests)
     - stratus_order_diagnosis_codes
     - stratus_order_medications
     - stratus_order_insurance (primary + secondary)
  2. Parses lab_results.result_data into:
     - stratus_result_observations
  3. Updates lab_orders with parsed patient/provider/lab columns
  4. Uses ON CONFLICT to be idempotent (safe to re-run)
*/

-- Backfill lab_orders parsed columns from order_data
UPDATE lab_orders
SET
  patient_first_name = COALESCE(order_data->'patient'->>'first_name', patient_first_name),
  patient_last_name = COALESCE(order_data->'patient'->>'last_name', patient_last_name),
  patient_dob = COALESCE(order_data->'patient'->>'dob', patient_dob),
  patient_gender = COALESCE(order_data->'patient'->>'gender_code', patient_gender),
  patient_id = COALESCE(order_data->'patient'->>'patient_id', patient_id),
  patient_phone_home = COALESCE(order_data->'patient'->>'home_phone', patient_phone_home),
  patient_phone_mobile = COALESCE(order_data->'patient'->>'mobile_phone', patient_phone_mobile),
  patient_phone_office = COALESCE(order_data->'patient'->>'office_phone', patient_phone_office),
  patient_email = COALESCE(order_data->'patient'->>'email_address', patient_email),
  patient_address = COALESCE(order_data->'patient'->>'address_street', patient_address),
  patient_city = COALESCE(order_data->'patient'->>'address_city', patient_city),
  patient_state = COALESCE(order_data->'patient'->>'address_state_code', patient_state),
  patient_zip = COALESCE(order_data->'patient'->>'address_zip', patient_zip),
  provider_first_name = COALESCE(order_data->'provider'->>'first_name', provider_first_name),
  provider_last_name = COALESCE(order_data->'provider'->>'last_name', provider_last_name),
  provider_npi = COALESCE(order_data->'provider'->>'npi', provider_npi),
  lab_name = COALESCE(order_data->'lab'->>'name', lab_name),
  lab_phone = COALESCE(order_data->'lab'->>'phone', lab_phone),
  lab_clia = COALESCE(order_data->'lab'->>'clia', lab_clia),
  lab_address = COALESCE(order_data->'lab'->>'address_street', lab_address),
  lab_city = COALESCE(order_data->'lab'->>'address_city', lab_city),
  lab_state = COALESCE(order_data->'lab'->>'address_state_code', lab_state),
  lab_zip = COALESCE(order_data->'lab'->>'address_zip', lab_zip),
  collected_datetime = COALESCE(order_data->'order'->>'collected_datetime', collected_datetime),
  requisition_datetime = COALESCE(order_data->'order'->>'requisition_datetime', requisition_datetime),
  received_datetime = COALESCE(order_data->'order'->>'received_datetime', received_datetime),
  finalized_datetime = COALESCE(order_data->'order'->>'finalized_datetime', finalized_datetime),
  requisition_by = COALESCE(order_data->'order'->>'requisition_by', requisition_by),
  order_comments = COALESCE(order_data->'order'->>'comments', order_comments),
  organization_name = COALESCE(order_data->'organization'->>'name', organization_name),
  location_name = COALESCE(order_data->'location'->>'name', location_name),
  order_status = COALESCE(order_data->>'status', order_status),
  accession_id = COALESCE(order_data->'order'->>'accession_id', accession_id),
  accession_number = COALESCE(order_data->'order'->>'accession_id', accession_number)
WHERE order_data IS NOT NULL AND order_data != '{}'::jsonb;

-- Backfill panels
INSERT INTO stratus_order_panels (lab_order_id, panel_name, panel_code, cpt_code, testmethod_code, testmethod_name, rapid_order, sample_type, specimen_type, interface_code, interface_text, orderset_name, orderset_billing_code, alt_panel_name, panel_notes, runby, runby_datetime, comments, sort_order)
SELECT
  lo.id,
  p->>'panel_name',
  p->>'panel_code',
  p->>'cpt_code',
  p->>'testmethod_code',
  p->>'testmethod_name',
  p->>'rapid_order',
  p->>'sample_type',
  p->>'specimen_type',
  p->>'interface_code',
  p->>'interface_text',
  p->>'orderset_name',
  p->>'orderset_billing_code',
  p->>'alt_panel_name',
  p->>'panel_notes',
  p->>'runby',
  p->>'runby_datetime',
  p->>'comments',
  idx AS sort_order
FROM lab_orders lo,
     jsonb_array_elements(lo.order_data->'panels') WITH ORDINALITY AS arr(p, idx)
WHERE lo.order_data->'panels' IS NOT NULL
  AND jsonb_typeof(lo.order_data->'panels') = 'array'
ON CONFLICT DO NOTHING;

-- Backfill tests (nested under panels)
-- We need to match panels by lab_order_id + sort_order
INSERT INTO stratus_order_tests (lab_order_id, order_panel_id, test_code, test_name, loinc_code, loinc_text, cpt_code, test_uom, test_description, test_notes, sort_order)
SELECT
  lo.id,
  sop.id,
  t->>'test_code',
  COALESCE(t->>'test_description', t->>'test_code'),
  t->>'loinc_code',
  t->>'loinc_text',
  t->>'cpt_code',
  t->>'test_uom',
  t->>'test_description',
  t->>'test_notes',
  tidx AS sort_order
FROM lab_orders lo
JOIN stratus_order_panels sop ON sop.lab_order_id = lo.id,
     jsonb_array_elements(lo.order_data->'panels') WITH ORDINALITY AS parr(p, pidx),
     jsonb_array_elements(p->'tests') WITH ORDINALITY AS arr(t, tidx)
WHERE sop.sort_order = pidx - 1
  AND p->'tests' IS NOT NULL
  AND jsonb_typeof(p->'tests') = 'array'
ON CONFLICT DO NOTHING;

-- Backfill diagnosis codes
INSERT INTO stratus_order_diagnosis_codes (lab_order_id, code, name, sort_order)
SELECT
  lo.id,
  d->>'code',
  d->>'name',
  idx AS sort_order
FROM lab_orders lo,
     jsonb_array_elements(lo.order_data->'diagnosis_codes') WITH ORDINALITY AS arr(d, idx)
WHERE lo.order_data->'diagnosis_codes' IS NOT NULL
  AND jsonb_typeof(lo.order_data->'diagnosis_codes') = 'array'
ON CONFLICT DO NOTHING;

-- Backfill medications
INSERT INTO stratus_order_medications (lab_order_id, code, name, sort_order)
SELECT
  lo.id,
  m->>'code',
  m->>'name',
  idx AS sort_order
FROM lab_orders lo,
     jsonb_array_elements(lo.order_data->'medications') WITH ORDINALITY AS arr(m, idx)
WHERE lo.order_data->'medications' IS NOT NULL
  AND jsonb_typeof(lo.order_data->'medications') = 'array'
ON CONFLICT DO NOTHING;

-- Backfill insurance (primary)
INSERT INTO stratus_order_insurance (lab_order_id, insurance_type, raw_data)
SELECT lo.id, 'primary', lo.order_data->'primary_insurance'
FROM lab_orders lo
WHERE lo.order_data->'primary_insurance' IS NOT NULL
  AND jsonb_typeof(lo.order_data->'primary_insurance') = 'object'
  AND lo.order_data->'primary_insurance' != '{}'::jsonb
ON CONFLICT DO NOTHING;

-- Backfill insurance (secondary)
INSERT INTO stratus_order_insurance (lab_order_id, insurance_type, raw_data)
SELECT lo.id, 'secondary', lo.order_data->'secondary_insurance'
FROM lab_orders lo
WHERE lo.order_data->'secondary_insurance' IS NOT NULL
  AND jsonb_typeof(lo.order_data->'secondary_insurance') = 'object'
  AND lo.order_data->'secondary_insurance' != '{}'::jsonb
ON CONFLICT DO NOTHING;

-- Backfill result observations
INSERT INTO stratus_result_observations (lab_result_id, lab_order_id, test_code, test_name, loinc_code, loinc_text, result_value, result_display, result_flag, result_uom, result_comments, result_cutoffvalue, result_medication, specimen_requirement, cpt_code, test_uom, test_description, test_notes, is_abnormal, sort_order)
SELECT
  lr.id,
  lr.lab_order_id,
  r->>'test_code',
  COALESCE(r->>'test_description', r->>'test_code'),
  r->>'loinc_code',
  r->>'loinc_text',
  r->>'result_value',
  r->>'result_display',
  r->>'result_flag',
  r->>'test_uom',
  r->>'result_comments',
  r->>'test_cutoffvalue',
  r->>'result_medication',
  r->>'specimen_requirement',
  r->>'cpt_code',
  r->>'test_uom',
  r->>'test_description',
  r->>'test_notes',
  (r->>'result_flag' IS NOT NULL AND r->>'result_flag' != '' AND r->>'result_flag' != 'N' AND UPPER(r->>'result_flag') != 'NORMAL'),
  (pidx - 1) * 1000 + (ridx - 1) AS sort_order
FROM lab_results lr,
     jsonb_array_elements(lr.result_data->'panels') WITH ORDINALITY AS parr(p, pidx),
     jsonb_array_elements(p->'results') WITH ORDINALITY AS arr(r, ridx)
WHERE lr.result_data->'panels' IS NOT NULL
  AND jsonb_typeof(lr.result_data->'panels') = 'array'
  AND p->'results' IS NOT NULL
  AND jsonb_typeof(p->'results') = 'array'
ON CONFLICT DO NOTHING;
