/*
  # Add Organization Logo Support

  ## Summary
  Adds logo upload capability to organizations, including:

  1. New Column
    - `logo_storage_path` (text, nullable) on `organizations` table
      - Stores the Supabase Storage path for the organization's logo image
      - Null when no logo has been uploaded (falls back to initials avatar in UI)

  2. New Storage Bucket
    - `organization-logos` — public bucket for organization logo images
    - 5MB file size limit
    - Allowed MIME types: JPEG, PNG, WebP, SVG+XML

  3. Storage Policies
    - Public read: any authenticated user can view logos
    - Proximity Staff (proximity_admin, proximity_staff) can insert/update/delete logos

  ## Notes
  - Bucket is public so logo URLs can be used directly in emails without signed URL expiry
  - Path structure: {organization_id}/{timestamp}.{ext}
*/

-- Add logo_storage_path column to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'logo_storage_path'
  ) THEN
    ALTER TABLE organizations ADD COLUMN logo_storage_path text;
  END IF;
END $$;

-- Create the organization-logos storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to read organization logos (public bucket, belt-and-suspenders)
CREATE POLICY "Authenticated users can read organization logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'organization-logos');

-- RLS: Proximity staff can upload organization logos
CREATE POLICY "Proximity staff can insert organization logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('proximity_admin', 'proximity_staff', 'super_admin')
    )
  );

-- RLS: Proximity staff can update organization logos
CREATE POLICY "Proximity staff can update organization logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('proximity_admin', 'proximity_staff', 'super_admin')
    )
  );

-- RLS: Proximity staff can delete organization logos
CREATE POLICY "Proximity staff can delete organization logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'organization-logos'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('proximity_admin', 'proximity_staff', 'super_admin')
    )
  );
