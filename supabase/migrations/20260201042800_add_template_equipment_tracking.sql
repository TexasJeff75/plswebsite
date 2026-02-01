/*
  # Add Template Equipment Tracking

  1. Changes to equipment table
    - Add `from_template` boolean column to track if equipment came from a template
    - Add `template_equipment_id` column to track which template equipment item this came from

  2. New Function
    - Create function to sync template updates to facilities using that template
    - Only adds new equipment items, doesn't remove existing ones
*/

-- Add columns to track template-sourced equipment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'from_template'
  ) THEN
    ALTER TABLE equipment ADD COLUMN from_template boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment' AND column_name = 'template_equipment_id'
  ) THEN
    ALTER TABLE equipment ADD COLUMN template_equipment_id uuid REFERENCES template_equipment(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for template equipment lookup
CREATE INDEX IF NOT EXISTS idx_equipment_template_equipment_id ON equipment(template_equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_from_template ON equipment(from_template);

-- Function to sync template equipment to all facilities using that template
CREATE OR REPLACE FUNCTION sync_template_equipment_to_facilities(p_template_id uuid)
RETURNS TABLE (
  facility_id uuid,
  equipment_added int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility record;
  v_template_equipment record;
  v_existing_types text[];
  v_equipment_count int;
BEGIN
  -- Loop through all facilities using this template
  FOR v_facility IN
    SELECT id FROM facilities
    WHERE deployment_template_id = p_template_id
  LOOP
    v_equipment_count := 0;

    -- Get existing equipment types for this facility
    SELECT array_agg(equipment_type) INTO v_existing_types
    FROM equipment
    WHERE facility_id = v_facility.id;

    IF v_existing_types IS NULL THEN
      v_existing_types := ARRAY[]::text[];
    END IF;

    -- Add equipment from template that doesn't already exist
    FOR v_template_equipment IN
      SELECT
        te.id as template_equipment_id,
        te.quantity,
        te.is_required,
        ec.equipment_name,
        ec.equipment_type,
        ec.procurement_method_default
      FROM template_equipment te
      JOIN equipment_catalog ec ON ec.id = te.equipment_catalog_id
      WHERE te.template_id = p_template_id
        AND ec.equipment_type NOT IN (SELECT unnest(v_existing_types))
    LOOP
      INSERT INTO equipment (
        facility_id,
        name,
        equipment_type,
        required,
        procurement_method,
        status,
        equipment_status,
        from_template,
        template_equipment_id
      ) VALUES (
        v_facility.id,
        v_template_equipment.equipment_name,
        v_template_equipment.equipment_type,
        v_template_equipment.is_required,
        v_template_equipment.procurement_method_default,
        'Not Ordered',
        'not_ordered',
        true,
        v_template_equipment.template_equipment_id
      );

      v_equipment_count := v_equipment_count + 1;
    END LOOP;

    facility_id := v_facility.id;
    equipment_added := v_equipment_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_template_equipment_to_facilities(uuid) TO authenticated;

-- Comment on function
COMMENT ON FUNCTION sync_template_equipment_to_facilities(uuid) IS
  'Syncs equipment from a template to all facilities using that template. Only adds new equipment types that dont already exist.';