/*
  # Create Equipment Images Storage

  1. Storage Setup
    - Creates an 'equipment-images' storage bucket for equipment photos
    - Bucket is private with signed URL access

  2. Database Changes
    - Adds `image_storage_path` column to equipment table

  3. Security (RLS Policies)
    - Authenticated users can upload, view, update, and delete equipment images

  4. Notes
    - Images are organized by facility_id/equipment_id: {facility_id}/{equipment_id}_{timestamp}_{filename}
    - Supports common image formats up to 10MB
*/

-- Create the equipment-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'equipment-images',
  'equipment-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment images
CREATE POLICY "Authenticated users can upload equipment images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'equipment-images');

CREATE POLICY "Authenticated users can view equipment images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'equipment-images');

CREATE POLICY "Authenticated users can update equipment images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'equipment-images');

CREATE POLICY "Authenticated users can delete equipment images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'equipment-images');

-- Add image_storage_path column to equipment table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'image_storage_path'
  ) THEN
    ALTER TABLE equipment ADD COLUMN image_storage_path text;
  END IF;
END $$;
