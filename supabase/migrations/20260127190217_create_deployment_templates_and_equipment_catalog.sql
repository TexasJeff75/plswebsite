/*
  # Create Deployment Templates and Equipment Catalog System

  1. New Tables
    - `deployment_templates`
      - Stores reusable deployment configurations for different lab types
      - Supports both system-wide templates and organization-specific templates
      - Types: mini_lab_waived, mini_lab_moderate, hosted_lab, custom
    
    - `equipment_catalog`
      - Master catalog of all possible equipment and instruments
      - Supports both system catalog items and organization-specific items
      - Categories: analyzer, poc_device, laptop, printer, barcode_scanner, centrifuge, refrigerator, other
    
    - `template_equipment`
      - Junction table linking templates to required equipment
      - Specifies quantity and whether equipment is required
    
    - `site_equipment`
      - Equipment assigned to specific sites
      - Tracks procurement method and status

  2. Security
    - Enable RLS on all tables
    - Proximity staff can manage system templates and catalog
    - Organization admins can manage their custom templates
    - All authenticated users can read templates and catalog

  3. Indexes
    - Optimized for template lookups by organization
    - Equipment catalog searches by type and organization
*/

-- Deployment Templates Table
CREATE TABLE IF NOT EXISTS deployment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text NOT NULL, -- 'mini_lab_waived', 'mini_lab_moderate', 'hosted_lab', 'custom'
  description text,
  is_system_template boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Equipment Catalog Table
CREATE TABLE IF NOT EXISTS equipment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  equipment_name text NOT NULL,
  equipment_type text NOT NULL, -- 'analyzer', 'poc_device', 'laptop', 'printer', 'barcode_scanner', 'centrifuge', 'refrigerator', 'other'
  manufacturer text,
  model_number text,
  procurement_method_default text DEFAULT 'purchase', -- 'reagent_rental', 'purchase', 'lease', 'client_provided'
  notes text,
  is_system_item boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template Equipment Junction Table
CREATE TABLE IF NOT EXISTS template_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES deployment_templates(id) ON DELETE CASCADE,
  equipment_catalog_id uuid NOT NULL REFERENCES equipment_catalog(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  is_required boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, equipment_catalog_id)
);

-- Site Equipment Table (replaces and extends existing equipment table if any)
CREATE TABLE IF NOT EXISTS site_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  equipment_catalog_id uuid REFERENCES equipment_catalog(id) ON DELETE SET NULL,
  equipment_name text NOT NULL,
  equipment_type text,
  manufacturer text,
  model_number text,
  serial_number text,
  procurement_method text DEFAULT 'purchase',
  procurement_status text DEFAULT 'pending', -- 'pending', 'ordered', 'received', 'installed', 'operational', 'decommissioned'
  installation_date date,
  warranty_expiration date,
  maintenance_schedule text,
  last_maintenance_date date,
  status text DEFAULT 'pending', -- 'pending', 'operational', 'maintenance', 'down', 'decommissioned'
  notes text,
  is_from_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE deployment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_equipment ENABLE ROW LEVEL SECURITY;

-- Deployment Templates Policies
CREATE POLICY "All authenticated users can read templates"
  ON deployment_templates FOR SELECT
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

CREATE POLICY "Admins can create templates"
  ON deployment_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Customer Admin')
    )
  );

CREATE POLICY "Admins can update templates"
  ON deployment_templates FOR UPDATE
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

CREATE POLICY "Admins can delete templates"
  ON deployment_templates FOR DELETE
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

-- Equipment Catalog Policies
CREATE POLICY "All authenticated users can read equipment catalog"
  ON equipment_catalog FOR SELECT
  TO authenticated
  USING (
    is_system_item = true 
    OR organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

CREATE POLICY "Admins can create equipment catalog items"
  ON equipment_catalog FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Customer Admin')
    )
  );

CREATE POLICY "Admins can update equipment catalog items"
  ON equipment_catalog FOR UPDATE
  TO authenticated
  USING (
    (is_system_item = false AND organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role = 'Customer Admin'
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Proximity Admin'
    )
  );

CREATE POLICY "Admins can delete equipment catalog items"
  ON equipment_catalog FOR DELETE
  TO authenticated
  USING (
    (is_system_item = false AND organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role = 'Customer Admin'
    ))
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'Proximity Admin'
    )
  );

-- Template Equipment Policies
CREATE POLICY "All authenticated users can read template equipment"
  ON template_equipment FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage template equipment"
  ON template_equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Customer Admin')
    )
  );

-- Site Equipment Policies
CREATE POLICY "Users can read site equipment"
  ON site_equipment FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM facilities f
      JOIN user_roles ur ON ur.organization_id = f.organization_id
      WHERE f.id = site_equipment.site_id
      AND ur.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant')
    )
  );

CREATE POLICY "Staff can manage site equipment"
  ON site_equipment FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Customer Admin')
    )
  );

-- Indexes
CREATE INDEX idx_deployment_templates_org_id ON deployment_templates(organization_id);
CREATE INDEX idx_deployment_templates_type ON deployment_templates(template_type);
CREATE INDEX idx_deployment_templates_system ON deployment_templates(is_system_template);

CREATE INDEX idx_equipment_catalog_org_id ON equipment_catalog(organization_id);
CREATE INDEX idx_equipment_catalog_type ON equipment_catalog(equipment_type);
CREATE INDEX idx_equipment_catalog_system ON equipment_catalog(is_system_item);

CREATE INDEX idx_template_equipment_template_id ON template_equipment(template_id);
CREATE INDEX idx_template_equipment_catalog_id ON template_equipment(equipment_catalog_id);

CREATE INDEX idx_site_equipment_site_id ON site_equipment(site_id);
CREATE INDEX idx_site_equipment_catalog_id ON site_equipment(equipment_catalog_id);
CREATE INDEX idx_site_equipment_status ON site_equipment(status);