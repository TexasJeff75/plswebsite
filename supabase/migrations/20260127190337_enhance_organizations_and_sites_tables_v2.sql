/*
  # Enhance Organizations and Sites Tables

  1. Organizations Table Enhancements
    - Add contract management fields (number, dates, status)
    - Add contact information fields
    - Add client classification (type, region)
    - Add deployment template references
    - Add customization flags

  2. Facilities (Sites) Table Enhancements
    - Add site type and facility type classification
    - Add location fields (latitude, longitude, timezone)
    - Add testing complexity classification
    - Add deployment template reference
    - Add custom configuration storage (jsonb)
    - Add readiness and compliance tracking
    - Add deployment notes
    - Add configuration lock flag

  3. Important Notes
    - All new fields use IF NOT EXISTS checks to prevent errors
    - Maintains backward compatibility with existing data
    - No data loss during migration
    - Uses latitude/longitude instead of PostGIS for simplicity
*/

DO $$
BEGIN
  -- Organizations Table Enhancements
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contract_number'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contract_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contract_start_date'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contract_start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contract_end_date'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contract_end_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contract_status'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contract_status text DEFAULT 'active'; -- 'active', 'pending', 'terminated'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'primary_contact_name'
  ) THEN
    ALTER TABLE organizations ADD COLUMN primary_contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'primary_contact_email'
  ) THEN
    ALTER TABLE organizations ADD COLUMN primary_contact_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'secondary_contact_name'
  ) THEN
    ALTER TABLE organizations ADD COLUMN secondary_contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'secondary_contact_email'
  ) THEN
    ALTER TABLE organizations ADD COLUMN secondary_contact_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'notes'
  ) THEN
    ALTER TABLE organizations ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE organizations ADD COLUMN client_type text DEFAULT 'mini_lab_network'; -- 'mini_lab_network', 'hosted_lab', 'hybrid', 'prospect'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'region'
  ) THEN
    ALTER TABLE organizations ADD COLUMN region text; -- 'midwest', 'southeast', 'southwest', 'northeast', 'west', 'national'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'default_deployment_template_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN default_deployment_template_id uuid REFERENCES deployment_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'uses_custom_equipment_catalog'
  ) THEN
    ALTER TABLE organizations ADD COLUMN uses_custom_equipment_catalog boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'uses_custom_milestone_templates'
  ) THEN
    ALTER TABLE organizations ADD COLUMN uses_custom_milestone_templates boolean DEFAULT false;
  END IF;

  -- Facilities (Sites) Table Enhancements
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'site_type'
  ) THEN
    ALTER TABLE facilities ADD COLUMN site_type text DEFAULT 'poc_site'; -- 'poc_site', 'clinical_lab', 'reference_lab', 'satellite'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'facility_type'
  ) THEN
    ALTER TABLE facilities ADD COLUMN facility_type text DEFAULT 'SNF'; -- 'SNF', 'ALF', 'hospital', 'clinic', 'urgent_care', 'physician_office', 'other'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE facilities ADD COLUMN timezone text DEFAULT 'America/Chicago';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'testing_complexity'
  ) THEN
    ALTER TABLE facilities ADD COLUMN testing_complexity text DEFAULT 'waived'; -- 'waived', 'moderate', 'high', 'mixed'
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'deployment_template_id'
  ) THEN
    ALTER TABLE facilities ADD COLUMN deployment_template_id uuid REFERENCES deployment_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'custom_configuration'
  ) THEN
    ALTER TABLE facilities ADD COLUMN custom_configuration jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'deployment_notes'
  ) THEN
    ALTER TABLE facilities ADD COLUMN deployment_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'go_live_readiness_score'
  ) THEN
    ALTER TABLE facilities ADD COLUMN go_live_readiness_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'last_compliance_review_date'
  ) THEN
    ALTER TABLE facilities ADD COLUMN last_compliance_review_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'configuration_locked'
  ) THEN
    ALTER TABLE facilities ADD COLUMN configuration_locked boolean DEFAULT false;
  END IF;
END $$;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_organizations_client_type ON organizations(client_type);
CREATE INDEX IF NOT EXISTS idx_organizations_region ON organizations(region);
CREATE INDEX IF NOT EXISTS idx_organizations_contract_status ON organizations(contract_status);
CREATE INDEX IF NOT EXISTS idx_organizations_default_template ON organizations(default_deployment_template_id);

CREATE INDEX IF NOT EXISTS idx_facilities_site_type ON facilities(site_type);
CREATE INDEX IF NOT EXISTS idx_facilities_facility_type ON facilities(facility_type);
CREATE INDEX IF NOT EXISTS idx_facilities_testing_complexity ON facilities(testing_complexity);
CREATE INDEX IF NOT EXISTS idx_facilities_deployment_template ON facilities(deployment_template_id);