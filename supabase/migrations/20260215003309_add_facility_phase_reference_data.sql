/*
  # Add Facility Phase Reference Data

  1. New Reference Data Category
    - `facility_phase` - Current deployment phase of a facility
      - Planning: Initial planning, not yet started
      - Construction: Room renovation in progress
      - Installation: Equipment being installed
      - Implementation: Training and integration underway
      - Go-Live: Final preparations
      - Completed: All milestones finished
      - Live: Facility operational
  
  2. Notes
    - These phases are auto-calculated based on milestone completion
    - Used for status badges and filtering in the facility list
    - Color codes provide visual indication of progress
*/

-- Facility Phases (auto-calculated values)
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('facility_phase', 'planning', 'Planning', 'Initial planning phase, milestones not yet started', 1, true, '#6b7280'),
('facility_phase', 'construction', 'Construction', 'Room renovation and infrastructure work in progress', 2, true, '#f97316'),
('facility_phase', 'installation', 'Installation', 'Equipment being delivered, installed, and calibrated', 3, true, '#3b82f6'),
('facility_phase', 'implementation', 'Implementation', 'Integration, training, and regulatory work in progress', 4, true, '#8b5cf6'),
('facility_phase', 'go_live', 'Go-Live', 'Final testing and preparations for launch', 5, true, '#eab308'),
('facility_phase', 'completed', 'Completed', 'All project milestones completed', 6, true, '#14b8a6'),
('facility_phase', 'live', 'Live', 'Facility operational and in clinical use', 7, true, '#10b981')
ON CONFLICT (category, code) DO NOTHING;