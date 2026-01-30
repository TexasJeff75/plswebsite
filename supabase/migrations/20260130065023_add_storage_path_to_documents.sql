/*
  # Add storage_path column to documents table

  1. Changes
    - Adds `storage_path` column to store the Supabase Storage path
    - This allows proper file deletion and signed URL generation

  2. Notes
    - The storage_path stores the path within the bucket (e.g., "facility_id/timestamp_filename.pdf")
    - The url column will now contain signed URLs that expire after 1 hour
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE documents ADD COLUMN storage_path text;
  END IF;
END $$;
