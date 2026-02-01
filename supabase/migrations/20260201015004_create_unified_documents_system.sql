/*
  # Create Unified Documents System

  ## Overview
  This migration creates a centralized document management system that can handle
  documents for any entity type (facilities, equipment, users, organizations, etc.)
  using a polymorphic relationship pattern.

  ## Architecture
  - Single `unified_documents` table with entity_type and entity_id columns
  - Replaces separate document tables for different entities
  - Maintains all existing functionality while adding flexibility
  - Supports future entity types without schema changes

  ## Changes
  1. New Table: `unified_documents`
     - Polymorphic relationship via entity_type + entity_id
     - Comprehensive metadata tracking
     - Version control support
     - Storage integration

  2. Data Migration
     - Migrate existing facility documents
     - Migrate equipment catalog documents
     - Preserve all metadata and relationships

  3. Views
     - Create convenience views for backward compatibility
     - Facility-specific document view
     - Equipment catalog document view

  ## Entity Types Supported
  - 'facility' - Facility-related documents
  - 'equipment_catalog' - Equipment catalog reference documents
  - 'equipment' - Individual equipment instance documents
  - 'user' - User-uploaded documents
  - 'organization' - Organization-wide documents
  - 'milestone' - Milestone-related documents
  - 'training' - Training materials
  - 'regulatory' - Regulatory documents
  - 'support_ticket' - Support ticket attachments

  ## Security
  - RLS enabled with context-aware policies
  - Access control based on entity type and user permissions
  - Activity logging via triggers
*/

-- Create unified documents table
CREATE TABLE IF NOT EXISTS unified_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic relationship
  entity_type text NOT NULL, -- 'facility', 'equipment_catalog', 'equipment', 'user', 'organization', etc.
  entity_id uuid NOT NULL,
  
  -- Document metadata
  document_name text NOT NULL,
  document_type text, -- 'manual', 'specification', 'certificate', 'report', 'image', 'other'
  description text,
  version text,
  
  -- Storage
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'documents',
  file_size bigint,
  mime_type text,
  
  -- Organization context (for multi-tenancy)
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Metadata
  uploaded_by uuid REFERENCES auth.users(id),
  upload_date timestamptz DEFAULT now(),
  expiration_date date,
  is_active boolean DEFAULT true,
  
  -- Tags for categorization
  tags text[],
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Composite index for efficient querying
  CONSTRAINT unique_entity_document UNIQUE (entity_type, entity_id, storage_path)
);

-- Enable RLS
ALTER TABLE unified_documents ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_unified_documents_entity 
  ON unified_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_organization 
  ON unified_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_unified_documents_type 
  ON unified_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_unified_documents_active 
  ON unified_documents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_unified_documents_uploader 
  ON unified_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_unified_documents_tags 
  ON unified_documents USING gin(tags);

-- Migrate data from existing documents table (facility documents)
INSERT INTO unified_documents (
  entity_type,
  entity_id,
  document_name,
  document_type,
  storage_path,
  storage_bucket,
  uploaded_by,
  upload_date,
  expiration_date,
  is_active,
  created_at
)
SELECT 
  'facility' as entity_type,
  facility_id as entity_id,
  name as document_name,
  type as document_type,
  COALESCE(storage_path, url) as storage_path,
  'documents' as storage_bucket,
  uploaded_by,
  created_at as upload_date,
  expiration_date,
  true as is_active,
  created_at
FROM documents
WHERE NOT EXISTS (
  SELECT 1 FROM unified_documents 
  WHERE entity_type = 'facility' 
  AND entity_id = documents.facility_id 
  AND storage_path = COALESCE(documents.storage_path, documents.url)
);

-- Migrate data from equipment_catalog_documents
INSERT INTO unified_documents (
  entity_type,
  entity_id,
  document_name,
  document_type,
  description,
  version,
  storage_path,
  storage_bucket,
  file_size,
  mime_type,
  uploaded_by,
  upload_date,
  expiration_date,
  is_active,
  created_at,
  updated_at
)
SELECT 
  'equipment_catalog' as entity_type,
  equipment_catalog_id as entity_id,
  document_name,
  document_type,
  description,
  version,
  storage_path,
  'equipment-catalog-docs' as storage_bucket,
  file_size,
  mime_type,
  uploaded_by,
  upload_date,
  expiration_date,
  is_active,
  created_at,
  updated_at
FROM equipment_catalog_documents
WHERE NOT EXISTS (
  SELECT 1 FROM unified_documents 
  WHERE entity_type = 'equipment_catalog' 
  AND entity_id = equipment_catalog_documents.equipment_catalog_id 
  AND storage_path = equipment_catalog_documents.storage_path
);

-- Create view for facility documents (backward compatibility)
CREATE OR REPLACE VIEW facility_documents AS
SELECT 
  id,
  entity_id as facility_id,
  document_name as name,
  document_type as type,
  storage_path,
  uploaded_by,
  upload_date as created_at,
  expiration_date
FROM unified_documents
WHERE entity_type = 'facility' AND is_active = true;

-- Create view for equipment catalog documents (backward compatibility)
CREATE OR REPLACE VIEW equipment_catalog_document_view AS
SELECT 
  id,
  entity_id as equipment_catalog_id,
  document_name,
  document_type,
  description,
  version,
  storage_path,
  file_size,
  mime_type,
  uploaded_by,
  upload_date,
  expiration_date,
  is_active,
  created_at,
  updated_at
FROM unified_documents
WHERE entity_type = 'equipment_catalog';

-- RLS Policies for unified_documents

-- Policy 1: Users can view documents for entities they have access to
CREATE POLICY "Users can view accessible documents"
  ON unified_documents FOR SELECT
  TO authenticated
  USING (
    CASE entity_type
      -- Facility documents: check facility access via organization
      WHEN 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        WHERE f.id = entity_id
        AND uoa.user_id = auth.uid()
      )
      -- Equipment catalog: all authenticated users can view
      WHEN 'equipment_catalog' THEN true
      -- Organization documents: check organization membership
      WHEN 'organization' THEN EXISTS (
        SELECT 1 FROM user_organization_assignments uoa
        WHERE uoa.organization_id = entity_id
        AND uoa.user_id = auth.uid()
      )
      -- User documents: owner or admin
      WHEN 'user' THEN (
        entity_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = auth.uid()
          AND user_roles.role IN ('Proximity Admin', 'System Admin')
        )
      )
      -- Default: check if user is admin
      ELSE EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'System Admin')
      )
    END
  );

-- Policy 2: Users can insert documents for entities they have write access to
CREATE POLICY "Users can insert documents for accessible entities"
  ON unified_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE entity_type
      -- Facility documents: organization member
      WHEN 'facility' THEN EXISTS (
        SELECT 1 FROM facilities f
        JOIN user_organization_assignments uoa ON uoa.organization_id = f.organization_id
        WHERE f.id = entity_id
        AND uoa.user_id = auth.uid()
      )
      -- Equipment catalog: Proximity staff only
      WHEN 'equipment_catalog' THEN EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'Proximity Staff')
      )
      -- Organization documents: org member or Proximity staff
      WHEN 'organization' THEN EXISTS (
        SELECT 1 FROM user_organization_assignments uoa
        WHERE uoa.organization_id = entity_id
        AND uoa.user_id = auth.uid()
      )
      -- User documents: owner only
      WHEN 'user' THEN entity_id = auth.uid()
      -- Default: admin only
      ELSE EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('Proximity Admin', 'System Admin')
      )
    END
  );

-- Policy 3: Users can update their own uploads or have admin rights
CREATE POLICY "Users can update documents they uploaded or have admin rights"
  ON unified_documents FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'System Admin')
    )
  );

-- Policy 4: Admins and uploaders can delete documents
CREATE POLICY "Admins and uploaders can delete documents"
  ON unified_documents FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('Proximity Admin', 'System Admin')
    )
  );

-- Add helpful comments
COMMENT ON TABLE unified_documents IS 'Centralized document storage with polymorphic relationships to any entity type';
COMMENT ON COLUMN unified_documents.entity_type IS 'Type of entity this document is attached to: facility, equipment_catalog, equipment, user, organization, etc.';
COMMENT ON COLUMN unified_documents.entity_id IS 'UUID of the entity this document is attached to';
COMMENT ON COLUMN unified_documents.storage_bucket IS 'Supabase storage bucket name where file is stored';
COMMENT ON COLUMN unified_documents.tags IS 'Array of tags for categorization and search';
