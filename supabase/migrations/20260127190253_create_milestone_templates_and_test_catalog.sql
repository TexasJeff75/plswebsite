/*
  # Create Milestone Templates and Test Catalog System

  1. New Tables
    - `milestone_templates`
      - Reusable milestone definitions for deployment phases
      - Supports both system templates and organization-specific templates
      - Includes categories, phases, SLAs, and dependencies
    
    - `template_milestones`
      - Junction table linking deployment templates to milestone templates
      - Allows customization of SLA per template
    
    - `test_catalog`
      - Master catalog of laboratory tests
      - Includes CPT codes, complexity levels, methodologies
      - Links to common instruments for each test
    
    - `site_test_menu`
      - Junction table for tests offered at each site
      - Tracks approval status and activation dates

  2. Security
    - Enable RLS on all tables
    - Proximity staff can manage system templates and catalog
    - Organization admins can manage their custom items
    - All authenticated users can read templates and catalog

  3. Indexes
    - Optimized for template and catalog lookups
    - Test searches by complexity and category
*/

-- Milestone Templates Table
CREATE TABLE IF NOT EXISTS milestone_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  category text NOT NULL, -- 'regulatory', 'equipment', 'integration', 'training', 'go_live', 'custom'
  title text NOT NULL,
  description text,
  responsible_party_default text, -- 'AMA', 'Proximity', 'Facility', 'Vendor'
  sla_hours numeric,
  dependencies jsonb DEFAULT '[]'::jsonb, -- Array of milestone template titles that must complete first
  sort_order integer DEFAULT 0,
  phase text, -- 'Not Started', 'Planning', 'Development', 'Testing', 'Deployment', 'Live'
  is_system_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template Milestones Junction Table
CREATE TABLE IF NOT EXISTS template_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_template_id uuid NOT NULL REFERENCES deployment_templates(id) ON DELETE CASCADE,
  milestone_template_id uuid NOT NULL REFERENCES milestone_templates(id) ON DELETE CASCADE,
  is_required boolean DEFAULT true,
  custom_sla_hours_override numeric,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(deployment_template_id, milestone_template_id)
);

-- Test Catalog Table
CREATE TABLE IF NOT EXISTS test_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  cpt_code text,
  test_category text NOT NULL, -- 'chemistry', 'hematology', 'coagulation', 'cardiac_markers', 'infectious_disease', 'urinalysis', 'other'
  complexity text NOT NULL, -- 'waived', 'moderate', 'high'
  methodology text,
  common_instruments jsonb DEFAULT '[]'::jsonb, -- Array of instrument names
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Site Test Menu Junction Table
CREATE TABLE IF NOT EXISTS site_test_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  test_catalog_id uuid NOT NULL REFERENCES test_catalog(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  approved_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(site_id, test_catalog_id)
);

-- Enable RLS
ALTER TABLE milestone_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_test_menu ENABLE ROW LEVEL SECURITY;

-- Milestone Templates Policies
CREATE POLICY "All authenticated users can read milestone templates"
  ON milestone_templates FOR SELECT
  TO authenticated
  USING (
    is_system_template = true 
    OR organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Admins can create milestone templates"
  ON milestone_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Customer Admin')
    )
  );

CREATE POLICY "Admins can update milestone templates"
  ON milestone_templates FOR UPDATE
  TO authenticated
  USING (
    (is_system_template = false AND organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role = 'Customer Admin'
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Admins can delete milestone templates"
  ON milestone_templates FOR DELETE
  TO authenticated
  USING (
    (is_system_template = false AND organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role = 'Customer Admin'
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Proximity Admin'
    )
  );

-- Template Milestones Policies
CREATE POLICY "All authenticated users can read template milestones"
  ON template_milestones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage template milestones"
  ON template_milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Customer Admin')
    )
  );

-- Test Catalog Policies
CREATE POLICY "All authenticated users can read test catalog"
  ON test_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage test catalog"
  ON test_catalog FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Compliance Specialist')
    )
  );

-- Site Test Menu Policies
CREATE POLICY "Users can read site test menu"
  ON site_test_menu FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_roles ur ON ur.organization_id = f.organization_id
      WHERE f.id = site_test_menu.site_id
      AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Compliance Specialist')
    )
  );

CREATE POLICY "Staff can manage site test menu"
  ON site_test_menu FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Compliance Specialist', 'Customer Admin')
    )
  );

-- Indexes
CREATE INDEX idx_milestone_templates_org_id ON milestone_templates(organization_id);
CREATE INDEX idx_milestone_templates_category ON milestone_templates(category);
CREATE INDEX idx_milestone_templates_phase ON milestone_templates(phase);
CREATE INDEX idx_milestone_templates_system ON milestone_templates(is_system_template);

CREATE INDEX idx_template_milestones_deployment_id ON template_milestones(deployment_template_id);
CREATE INDEX idx_template_milestones_milestone_id ON template_milestones(milestone_template_id);

CREATE INDEX idx_test_catalog_category ON test_catalog(test_category);
CREATE INDEX idx_test_catalog_complexity ON test_catalog(complexity);
CREATE INDEX idx_test_catalog_cpt_code ON test_catalog(cpt_code);

CREATE INDEX idx_site_test_menu_site_id ON site_test_menu(site_id);
CREATE INDEX idx_site_test_menu_test_id ON site_test_menu(test_catalog_id);
CREATE INDEX idx_site_test_menu_active ON site_test_menu(active);