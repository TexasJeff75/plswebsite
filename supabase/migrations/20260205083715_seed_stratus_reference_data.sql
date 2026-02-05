/*
  # Seed StratusDX Reference Data
  
  1. Organizations
    - Seed the stratus_organizations table with known StratusDX organizations
    - Organization codes: AMMO, AMGA, CSPI, HS360, HTX, PWIK, RHC, RLC, RCPM, SCNC, TEST
  
  2. Test Methods
    - Seed the stratus_test_methods table with known test method codes and names
    - Examples: AMA Confirmation, AMA Screens, PCR Testing, HS360 Blood, etc.
  
  3. Notes
    - Uses ON CONFLICT to avoid duplicates if migration runs multiple times
    - All records are set to active by default
*/

-- Seed StratusDX Organizations
INSERT INTO stratus_organizations (organization_code, organization_name, is_active) VALUES
  ('AMMO', 'American Medical Administrators - MO', true),
  ('AMGA', 'AMGA HC Lab', true),
  ('CSPI', 'Coastal Spine & Pain Institute', true),
  ('HS360', 'Health Services 360', true),
  ('HTX', 'Health Texas', true),
  ('PWIK', 'Pain & Wellness Institute of Kentucky', true),
  ('RHC', 'Regional Healthcare', true),
  ('RLC', 'Regional Lab Center', true),
  ('RCPM', 'Regional Center for Pain Management', true),
  ('SCNC', 'Spine Center of North Carolina', true),
  ('TEST', 'Test Organization', true)
ON CONFLICT (organization_code) DO UPDATE SET
  organization_name = EXCLUDED.organization_name,
  updated_at = now();

-- Seed StratusDX Test Methods
INSERT INTO stratus_test_methods (test_method_code, test_method_name, is_active) VALUES
  ('AMA Confirmation', 'AMA Confirmation', true),
  ('AMA Screens', 'AMA Screens', true),
  ('PCR Testing', 'PCR Testing', true),
  ('HS360 Blood', 'HS360 Blood', true),
  ('HTX Confirmation', 'HTX Confirmation', true),
  ('HTX Screens', 'HTX Screens', true),
  ('PWIK Testing', 'PWIK Testing', true),
  ('RHC Confirmation', 'RHC Confirmation', true),
  ('RHC Screens', 'RHC Screens', true),
  ('RLC Testing', 'RLC Testing', true),
  ('RCPM Confirmation', 'RCPM Confirmation', true),
  ('RCPM Screens', 'RCPM Screens', true),
  ('SCNC Testing', 'SCNC Testing', true),
  ('Standard Testing', 'Standard Testing', true)
ON CONFLICT (test_method_code) DO UPDATE SET
  test_method_name = EXCLUDED.test_method_name,
  updated_at = now();
