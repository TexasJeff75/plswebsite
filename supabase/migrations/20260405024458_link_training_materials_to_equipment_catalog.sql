/*
  # Link Training Materials to Equipment Catalog

  ## Summary
  Adds a foreign key relationship from training_materials to the equipment_catalog
  table so each training material can be associated with a specific piece of
  equipment in the catalog.

  ## Changes

  ### Modified Tables
  - `training_materials`
    - Adds `equipment_catalog_id` (uuid, nullable FK → equipment_catalog.id)
      This replaces the free-text `equipment_type` field for structured linking,
      while keeping `equipment_type` for backward compatibility / free-text fallback.

  ### New Index
  - `idx_training_materials_equipment_catalog_id` on training_materials(equipment_catalog_id)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_materials' AND column_name = 'equipment_catalog_id'
  ) THEN
    ALTER TABLE training_materials
      ADD COLUMN equipment_catalog_id uuid REFERENCES equipment_catalog(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_materials_equipment_catalog_id
  ON training_materials(equipment_catalog_id);
