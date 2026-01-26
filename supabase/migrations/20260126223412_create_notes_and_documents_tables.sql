/*
  # Create Notes and Documents Tables

  1. New Tables
    - `notes`
      - `id` (uuid, primary key) - Unique identifier
      - `facility_id` (uuid, foreign key) - Reference to facility
      - `milestone_id` (uuid, foreign key) - Optional reference to specific milestone
      - `content` (text) - Note content
      - `created_by` (uuid) - User who created the note
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `documents`
      - `id` (uuid, primary key) - Unique identifier
      - `facility_id` (uuid, foreign key) - Reference to facility
      - `milestone_id` (uuid, foreign key) - Optional reference to specific milestone
      - `document_name` (text) - Document filename
      - `document_type` (text) - Document category
      - `document_url` (text) - URL or storage path
      - `file_size` (bigint) - File size in bytes
      - `uploaded_by` (uuid) - User who uploaded
      - `uploaded_at` (timestamptz) - Upload timestamp

  2. Document Types
    - CLIA Certificate
    - Training Records
    - Compliance Documents
    - Photos
    - Other

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text NOT NULL DEFAULT 'Other',
  document_url text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  CONSTRAINT valid_document_type CHECK (document_type IN ('CLIA Certificate', 'Training Records', 'Compliance Documents', 'Photos', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_notes_facility ON notes(facility_id);
CREATE INDEX IF NOT EXISTS idx_notes_milestone ON notes(milestone_id);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_facility ON documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_documents_milestone ON documents(milestone_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete their own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can read documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete their own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);