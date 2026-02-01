/*
  # Fix Missing Foreign Key Indexes

  ## Overview
  Adds missing indexes on foreign key columns to improve query performance and prevent suboptimal joins.

  ## Changes Made

  ### 1. New Indexes
  - `idx_equipment_catalog_documents_uploaded_by` - Covers uploaded_by foreign key
  - `idx_unified_documents_retired_by` - Covers retired_by foreign key

  ## Performance Impact
  - Improves JOIN performance when querying documents by uploader/retirer
  - Reduces query planning overhead for foreign key constraint validation
  - Essential for optimal performance at scale
*/

-- Add index for equipment_catalog_documents.uploaded_by foreign key
CREATE INDEX IF NOT EXISTS idx_equipment_catalog_documents_uploaded_by
  ON equipment_catalog_documents(uploaded_by);

-- Add index for unified_documents.retired_by foreign key
CREATE INDEX IF NOT EXISTS idx_unified_documents_retired_by
  ON unified_documents(retired_by);
