/*
  # Create Auto-Milestones Trigger

  1. Function
    - Creates a function that automatically creates the 9 default milestones
      when a new facility is inserted
    
  2. Trigger
    - Attaches the function to the facilities table INSERT operation

  3. Default Milestones
    1. Site Assessment Complete
    2. CLIA Certificate Obtained
    3. Lab Director Assigned
    4. Equipment Shipped
    5. Equipment Installed
    6. Network/LIS Integration
    7. Staff Training Complete
    8. Competency Testing Done
    9. Go-Live
*/

CREATE OR REPLACE FUNCTION create_default_milestones()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO milestones (facility_id, milestone_name, milestone_order, status)
  VALUES
    (NEW.id, 'Site Assessment Complete', 1, 'Not Started'),
    (NEW.id, 'CLIA Certificate Obtained', 2, 'Not Started'),
    (NEW.id, 'Lab Director Assigned', 3, 'Not Started'),
    (NEW.id, 'Equipment Shipped', 4, 'Not Started'),
    (NEW.id, 'Equipment Installed', 5, 'Not Started'),
    (NEW.id, 'Network/LIS Integration', 6, 'Not Started'),
    (NEW.id, 'Staff Training Complete', 7, 'Not Started'),
    (NEW.id, 'Competency Testing Done', 8, 'Not Started'),
    (NEW.id, 'Go-Live', 9, 'Not Started');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_default_milestones ON facilities;

CREATE TRIGGER trigger_create_default_milestones
  AFTER INSERT ON facilities
  FOR EACH ROW
  EXECUTE FUNCTION create_default_milestones();