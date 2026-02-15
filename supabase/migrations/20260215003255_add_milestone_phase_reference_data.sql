/*
  # Add Milestone Phase Reference Data

  1. New Reference Data Category
    - `milestone_phase` - Project phases for milestone tracking
      - Construction: Room preparation, renovation, and infrastructure work
      - Installation: Equipment delivery, setup, and calibration
      - Implementation: Integration, training, and regulatory approval
      - Go-Live: Final testing and activation
  
  2. Notes
    - These phases are used to organize milestones in the facility detail view
    - Construction phase is optional and only appears for facilities that require it
    - Color codes help visually distinguish phases in the UI
*/

-- Milestone Phases
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('milestone_phase', 'construction', 'Construction', 'Room preparation, renovation, infrastructure (painting, flooring, cabinets, plumbing, lighting)', 1, true, '#f97316'),
('milestone_phase', 'installation', 'Installation', 'Equipment delivery, setup, calibration, and initial testing', 2, true, '#3b82f6'),
('milestone_phase', 'implementation', 'Implementation', 'System integration, staff training, and regulatory approval', 3, true, '#8b5cf6'),
('milestone_phase', 'go_live', 'Go-Live', 'Final testing, validation, and facility activation', 4, true, '#eab308')
ON CONFLICT (category, code) DO NOTHING;