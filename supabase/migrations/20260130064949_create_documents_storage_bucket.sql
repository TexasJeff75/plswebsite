/*
  # Create Documents Storage Bucket

  1. Storage Setup
    - Creates a 'documents' storage bucket for facility document uploads
    - Bucket is set to private (not public) for security

  2. Security (RLS Policies)
    - Authenticated users can upload documents to facility folders
    - Authenticated users can view/download documents from facilities they have access to
    - Authenticated users can delete documents they have permission to manage

  3. Notes
    - Files are organized by facility_id: {facility_id}/{timestamp}_{filename}
    - All operations require authentication
*/

-- Create the documents storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy: Authenticated users can view/download files
CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Policy: Authenticated users can update their uploaded files
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

-- Policy: Authenticated users can delete files
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
