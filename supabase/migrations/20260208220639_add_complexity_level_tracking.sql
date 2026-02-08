/*
  # Add Complexity Level Tracking for Facility Upgrades

  ## Purpose
  Enable facilities to upgrade from CLIA Waived → Moderate → High Complexity without data duplication.
  Templates can be tagged with applicable complexity levels for incremental application.

  ## Changes

  ### 1. New Types
  - `complexity_level` enum: 'CLIA Waived', 'Moderate Complexity', 'High Complexity'

  ### 2. Facilities Table
  - Add `complexity_level` column (tracks current certification level)
  - Add `complexity_level_history` JSONB (tracks upgrade timeline)

  ### 3. Deployment Templates
  - Add `target_complexity_level` (what level this template is designed for)
  - Add `is_incremental` boolean (true = only adds delta items, false = full deployment)

  ### 4. Milestone Templates
  - Add `applicable_complexity_levels` text array (which complexity levels need this milestone)
  - Add `is_required_for_complexity` boolean (some milestones may be optional)

  ### 5. Equipment Catalog
  - Add `applicable_complexity_levels` text array (which complexity levels need this equipment)
  - Add `complexity_specific_notes` text (notes about complexity-specific requirements)

  ## Usage Pattern
  1. Create facility with initial complexity level (e.g., CLIA Waived)
  2. Apply full deployment template
  3. Later, upgrade facility complexity level
  4. Create new project for upgrade
  5. Apply incremental template → only net-new items are added (smart deduplication)

  ## Security
  - No RLS changes needed (inherits existing policies)
*/

-- Create complexity level enum
DO $$ BEGIN
  CREATE TYPE complexity_level AS ENUM (
    'CLIA Waived',
    'Moderate Complexity',
    'High Complexity'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add complexity level to facilities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'facilities' AND column_name = 'complexity_level'
  ) THEN
    ALTER TABLE facilities 
    ADD COLUMN complexity_level complexity_level DEFAULT 'CLIA Waived',
    ADD COLUMN complexity_level_history JSONB DEFAULT '[]'::jsonb;
    
    -- Add helpful comment
    COMMENT ON COLUMN facilities.complexity_level IS 'Current CLIA complexity certification level';
    COMMENT ON COLUMN facilities.complexity_level_history IS 'Array of {level, date, notes} tracking upgrades';
  END IF;
END $$;

-- Add complexity level to deployment templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deployment_templates' AND column_name = 'target_complexity_level'
  ) THEN
    ALTER TABLE deployment_templates 
    ADD COLUMN target_complexity_level complexity_level DEFAULT 'CLIA Waived',
    ADD COLUMN is_incremental boolean DEFAULT false;
    
    COMMENT ON COLUMN deployment_templates.target_complexity_level IS 'Primary complexity level this template targets';
    COMMENT ON COLUMN deployment_templates.is_incremental IS 'If true, template only adds delta items (for upgrades)';
  END IF;
END $$;

-- Add applicable complexity levels to milestone templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestone_templates' AND column_name = 'applicable_complexity_levels'
  ) THEN
    ALTER TABLE milestone_templates 
    ADD COLUMN applicable_complexity_levels text[] DEFAULT ARRAY['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
    ADD COLUMN is_required_for_complexity boolean DEFAULT true;
    
    COMMENT ON COLUMN milestone_templates.applicable_complexity_levels IS 'Which complexity levels require this milestone';
    COMMENT ON COLUMN milestone_templates.is_required_for_complexity IS 'Whether this milestone is mandatory for listed complexity levels';
  END IF;
END $$;

-- Add applicable complexity levels to equipment catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_catalog' AND column_name = 'applicable_complexity_levels'
  ) THEN
    ALTER TABLE equipment_catalog 
    ADD COLUMN applicable_complexity_levels text[] DEFAULT ARRAY['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
    ADD COLUMN complexity_specific_notes text;
    
    COMMENT ON COLUMN equipment_catalog.applicable_complexity_levels IS 'Which complexity levels require this equipment';
    COMMENT ON COLUMN equipment_catalog.complexity_specific_notes IS 'Notes about complexity-specific requirements or configurations';
  END IF;
END $$;

-- Create index for complexity level filtering
CREATE INDEX IF NOT EXISTS idx_facilities_complexity_level 
  ON facilities(complexity_level);

CREATE INDEX IF NOT EXISTS idx_deployment_templates_target_complexity 
  ON deployment_templates(target_complexity_level);

CREATE INDEX IF NOT EXISTS idx_milestone_templates_applicable_complexity 
  ON milestone_templates USING GIN(applicable_complexity_levels);

CREATE INDEX IF NOT EXISTS idx_equipment_catalog_applicable_complexity 
  ON equipment_catalog USING GIN(applicable_complexity_levels);

-- Add function to track complexity level changes
CREATE OR REPLACE FUNCTION track_facility_complexity_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If complexity level changed, append to history
  IF OLD.complexity_level IS DISTINCT FROM NEW.complexity_level THEN
    NEW.complexity_level_history = COALESCE(NEW.complexity_level_history, '[]'::jsonb) || 
      jsonb_build_object(
        'from_level', OLD.complexity_level,
        'to_level', NEW.complexity_level,
        'changed_at', now(),
        'changed_by', auth.uid()
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for complexity level tracking
DROP TRIGGER IF EXISTS track_facility_complexity_change_trigger ON facilities;
CREATE TRIGGER track_facility_complexity_change_trigger
  BEFORE UPDATE ON facilities
  FOR EACH ROW
  WHEN (OLD.complexity_level IS DISTINCT FROM NEW.complexity_level)
  EXECUTE FUNCTION track_facility_complexity_change();
