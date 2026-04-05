/*
  # Create Training Center Materials System

  ## Summary
  Adds a dedicated training materials library for storing and organizing staff
  training content including videos, documents, images, and links.

  ## New Tables

  ### training_materials
  A central repository for all training content used to train staff on equipment
  and procedures. Supports multiple material types.

  Columns:
  - id (uuid, PK)
  - title (text) - Display name for the material
  - description (text) - Detailed description of the content
  - category (text) - Grouping: 'equipment', 'procedure', 'compliance', 'onboarding', 'other'
  - material_type (text) - Type: 'video', 'document', 'image', 'link', 'presentation'
  - video_url (text) - External video URL (YouTube, Vimeo, etc.)
  - external_link (text) - Any external reference URL
  - storage_path (text) - Path to file in Supabase storage
  - storage_bucket (text) - Bucket name for file storage
  - file_name (text) - Original filename
  - file_size (bigint) - File size in bytes
  - mime_type (text) - File MIME type
  - thumbnail_url (text) - Optional thumbnail image URL
  - tags (text[]) - Searchable tags
  - equipment_type (text) - Optional: associate with specific equipment type
  - is_published (boolean) - Controls visibility to non-admin users
  - view_count (integer) - Track how many times material has been accessed
  - uploaded_by (uuid, FK to auth.users)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - RLS enabled with policies for:
    - Published materials: all authenticated users can view
    - All materials: admins (is_internal = true or Customer Admin) can manage
    - Upload tracking: linked to auth.uid()

  ## Storage
  - New bucket: training-materials (private, 100MB limit, common media/doc types)
*/

-- Training materials table
CREATE TABLE IF NOT EXISTS training_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('equipment', 'procedure', 'compliance', 'onboarding', 'safety', 'other')),
  material_type text NOT NULL DEFAULT 'document'
    CHECK (material_type IN ('video', 'document', 'image', 'link', 'presentation')),
  video_url text,
  external_link text,
  storage_path text,
  storage_bucket text DEFAULT 'training-materials',
  file_name text,
  file_size bigint,
  mime_type text,
  thumbnail_url text,
  tags text[] DEFAULT '{}',
  equipment_type text,
  is_published boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_materials_category ON training_materials(category);
CREATE INDEX IF NOT EXISTS idx_training_materials_material_type ON training_materials(material_type);
CREATE INDEX IF NOT EXISTS idx_training_materials_is_published ON training_materials(is_published);
CREATE INDEX IF NOT EXISTS idx_training_materials_uploaded_by ON training_materials(uploaded_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_training_materials_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_materials_updated_at ON training_materials;
CREATE TRIGGER training_materials_updated_at
  BEFORE UPDATE ON training_materials
  FOR EACH ROW EXECUTE FUNCTION update_training_materials_updated_at();

-- Enable RLS
ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view published materials
CREATE POLICY "Authenticated users can view published training materials"
  ON training_materials
  FOR SELECT
  TO authenticated
  USING (
    is_published = true
    OR (SELECT is_internal_user() AS is_internal_user) = true
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'Customer Admin'
    )
  );

-- Internal users (admins/staff) can insert
CREATE POLICY "Internal users can insert training materials"
  ON training_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_internal_user() AS is_internal_user) = true
  );

-- Internal users can update training materials
CREATE POLICY "Internal users can update training materials"
  ON training_materials
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_internal_user() AS is_internal_user) = true
  )
  WITH CHECK (
    (SELECT is_internal_user() AS is_internal_user) = true
  );

-- Internal users can delete training materials
CREATE POLICY "Internal users can delete training materials"
  ON training_materials
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_internal_user() AS is_internal_user) = true
  );

-- Storage bucket for training materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'training-materials',
  'training-materials',
  false,
  104857600, -- 100MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can read
CREATE POLICY "Authenticated users can read training materials storage"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'training-materials');

-- Storage RLS: internal users can upload
CREATE POLICY "Internal users can upload training materials"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'training-materials'
    AND (SELECT is_internal_user() AS is_internal_user) = true
  );

-- Storage RLS: internal users can update
CREATE POLICY "Internal users can update training material files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'training-materials'
    AND (SELECT is_internal_user() AS is_internal_user) = true
  );

-- Storage RLS: internal users can delete
CREATE POLICY "Internal users can delete training material files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'training-materials'
    AND (SELECT is_internal_user() AS is_internal_user) = true
  );
