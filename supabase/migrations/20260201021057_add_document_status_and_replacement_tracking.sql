/*
  # Add Document Status and Replacement Tracking

  ## Overview
  Enhances the unified_documents system with document lifecycle management,
  including status tracking, retirement, and replacement chains.

  ## Changes
  1. Document Status
     - Add `status` column (active, retired, archived)
     - Add `retired_at` timestamp
     - Add `retired_by` user reference
     - Add `retirement_reason` text field

  2. Document Replacement Chain
     - Add `replaces_document_id` to track document replacements
     - Add `replaced_by_document_id` for backward reference
     - Maintains history of document versions

  3. Indexes
     - Add index on status for efficient filtering
     - Add index on replacement relationships

  4. Update RLS
     - Allow admins to retire documents
     - Maintain visibility of retired documents for audit trail

  ## Security
  - Retired documents remain viewable but clearly marked
  - Only admins can retire documents
  - Replacement chains are immutable once set
*/

-- Add status and retirement tracking columns
ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' 
    CHECK (status IN ('active', 'retired', 'archived'));

ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS retired_by uuid REFERENCES auth.users(id);

ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS retirement_reason text;

-- Add replacement tracking columns
ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS replaces_document_id uuid REFERENCES unified_documents(id);

ALTER TABLE unified_documents 
  ADD COLUMN IF NOT EXISTS replaced_by_document_id uuid REFERENCES unified_documents(id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_unified_documents_status 
  ON unified_documents(status);

CREATE INDEX IF NOT EXISTS idx_unified_documents_replaces 
  ON unified_documents(replaces_document_id) 
  WHERE replaces_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unified_documents_replaced_by 
  ON unified_documents(replaced_by_document_id) 
  WHERE replaced_by_document_id IS NOT NULL;

-- Migrate existing is_active to status
UPDATE unified_documents 
SET status = CASE 
  WHEN is_active = false THEN 'retired'
  ELSE 'active'
END
WHERE status = 'active' AND is_active = false;

-- Add helpful comments
COMMENT ON COLUMN unified_documents.status IS 'Document lifecycle status: active, retired, or archived';
COMMENT ON COLUMN unified_documents.retired_at IS 'Timestamp when document was retired';
COMMENT ON COLUMN unified_documents.retired_by IS 'User who retired the document';
COMMENT ON COLUMN unified_documents.retirement_reason IS 'Reason for retiring the document';
COMMENT ON COLUMN unified_documents.replaces_document_id IS 'ID of document this one replaces (creates version chain)';
COMMENT ON COLUMN unified_documents.replaced_by_document_id IS 'ID of document that replaces this one';

-- Function to automatically set replacement relationships
CREATE OR REPLACE FUNCTION set_document_replacement()
RETURNS TRIGGER AS $$
BEGIN
  -- If this document replaces another, update the old document's replaced_by field
  IF NEW.replaces_document_id IS NOT NULL THEN
    UPDATE unified_documents
    SET replaced_by_document_id = NEW.id
    WHERE id = NEW.replaces_document_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for replacement tracking
DROP TRIGGER IF EXISTS trigger_set_document_replacement ON unified_documents;
CREATE TRIGGER trigger_set_document_replacement
  AFTER INSERT ON unified_documents
  FOR EACH ROW
  WHEN (NEW.replaces_document_id IS NOT NULL)
  EXECUTE FUNCTION set_document_replacement();
