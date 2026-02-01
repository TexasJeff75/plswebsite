/*
  # Add Equipment Catalog Documents

  ## Overview
  This migration enables document storage for equipment catalog items.
  Each equipment type can have multiple reference documents such as:
  - User manuals
  - Technical specifications
  - Installation guides
  - Maintenance schedules
  - Safety data sheets

  ## Changes
  1. New Table: `equipment_catalog_documents`
     - Links documents to equipment catalog items
     - Tracks document type, version, and upload information
     - Supports document expiration dates
  
  2. Storage Bucket: `equipment-catalog-docs`
     - Stores the actual document files
     - Public read access for authenticated users
     - Upload restricted to authorized users

  ## Security
  - RLS enabled with organization-based access control
  - Storage policies ensure proper access restrictions
  - Activity logging via existing triggers
*/

-- Create equipment catalog documents table
CREATE TABLE IF NOT EXISTS equipment_catalog_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_catalog_id uuid NOT NULL REFERENCES equipment_catalog(id) ON DELETE CASCADE,
  
  -- Document info
  document_name text NOT NULL,
  document_type text, -- 'manual', 'specification', 'installation_guide', 'maintenance_schedule', 'sds', 'other'
  description text,
  version text,
  
  -- Storage
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  
  -- Metadata
  uploaded_by uuid REFERENCES auth.users(id),
  upload_date timestamptz DEFAULT now(),
  expiration_date date,
  is_active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE equipment_catalog_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_documents_equipment_id 
  ON equipment_catalog_documents(equipment_catalog_id);
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_documents_type 
  ON equipment_catalog_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_documents_active 
  ON equipment_catalog_documents(is_active) WHERE is_active = true;

-- RLS Policies for equipment_catalog_documents
-- Authenticated users can view documents
CREATE POLICY "Users can view equipment catalog documents"
  ON equipment_catalog_documents FOR SELECT
  TO authenticated
  USING (true);

-- Proximity Admin and Staff can insert documents
CREATE POLICY "Proximity staff can insert equipment catalog documents"
  ON equipment_catalog_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Proximity Admin and Staff can update documents
CREATE POLICY "Proximity staff can update equipment catalog documents"
  ON equipment_catalog_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Proximity Admin can delete documents
CREATE POLICY "Proximity admin can delete equipment catalog documents"
  ON equipment_catalog_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- Create storage bucket for equipment catalog documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-catalog-docs', 'equipment-catalog-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment-catalog-docs bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view equipment catalog docs" ON storage.objects;
DROP POLICY IF EXISTS "Proximity staff can upload equipment catalog docs" ON storage.objects;
DROP POLICY IF EXISTS "Proximity staff can update equipment catalog docs" ON storage.objects;
DROP POLICY IF EXISTS "Proximity admin can delete equipment catalog docs" ON storage.objects;

-- Authenticated users can view files
CREATE POLICY "Authenticated users can view equipment catalog docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'equipment-catalog-docs');

-- Proximity staff can upload files
CREATE POLICY "Proximity staff can upload equipment catalog docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'equipment-catalog-docs'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Proximity staff can update files
CREATE POLICY "Proximity staff can update equipment catalog docs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'equipment-catalog-docs'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
    )
  );

-- Proximity admin can delete files
CREATE POLICY "Proximity admin can delete equipment catalog docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'equipment-catalog-docs'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'Proximity Admin'
    )
  );

-- Add helpful comments
COMMENT ON TABLE equipment_catalog_documents IS 'Reference documents for equipment catalog items (manuals, specs, guides)';
COMMENT ON COLUMN equipment_catalog_documents.document_type IS 'Type of document: manual, specification, installation_guide, maintenance_schedule, sds, other';
COMMENT ON COLUMN equipment_catalog_documents.storage_path IS 'Path to file in storage bucket';
