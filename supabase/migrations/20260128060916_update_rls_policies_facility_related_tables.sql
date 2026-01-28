/*
  # Update RLS Policies for Facility-Related Tables
  
  This migration updates RLS policies for all tables that reference facilities,
  ensuring users can only access data for facilities in their assigned organizations.
  
  ## Tables Updated
  - equipment
  - milestones
  - regulatory_info
  - training_info
  - personnel_info
  - trained_personnel
  - documents
  - integration_info
  - interface_status
  - facility_readiness_info
  - notes
  - activity_log
  - site_equipment
  - site_test_menu
  - compliance_events
  - deficiencies
  
  ## Security
  - All SELECT policies check facility access via user_can_access_facility()
  - Modification policies require appropriate role within the organization
*/

-- Equipment table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON equipment;
DROP POLICY IF EXISTS "Users can view equipment" ON equipment;
DROP POLICY IF EXISTS "Authenticated users can read equipment" ON equipment;
DROP POLICY IF EXISTS "Staff can manage equipment" ON equipment;
DROP POLICY IF EXISTS "Users can view equipment in accessible facilities" ON equipment;
DROP POLICY IF EXISTS "Users can manage equipment in accessible facilities" ON equipment;

CREATE POLICY "Users can view equipment in accessible facilities" ON equipment
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert equipment in accessible facilities" ON equipment
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update equipment in accessible facilities" ON equipment
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete equipment" ON equipment
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Milestones table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON milestones;
DROP POLICY IF EXISTS "Users can view milestones" ON milestones;
DROP POLICY IF EXISTS "Authenticated users can read milestones" ON milestones;
DROP POLICY IF EXISTS "Staff can manage milestones" ON milestones;
DROP POLICY IF EXISTS "Users can view milestones in accessible facilities" ON milestones;
DROP POLICY IF EXISTS "Users can manage milestones in accessible facilities" ON milestones;

CREATE POLICY "Users can view milestones in accessible facilities" ON milestones
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert milestones in accessible facilities" ON milestones
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update milestones in accessible facilities" ON milestones
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete milestones" ON milestones
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Regulatory Info table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON regulatory_info;
DROP POLICY IF EXISTS "Users can view regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Authenticated users can read regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Staff can manage regulatory_info" ON regulatory_info;
DROP POLICY IF EXISTS "Users can view regulatory info in accessible facilities" ON regulatory_info;
DROP POLICY IF EXISTS "Users can manage regulatory info in accessible facilities" ON regulatory_info;

CREATE POLICY "Users can view regulatory info in accessible facilities" ON regulatory_info
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert regulatory info in accessible facilities" ON regulatory_info
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update regulatory info in accessible facilities" ON regulatory_info
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete regulatory info" ON regulatory_info
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Training Info table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON training_info;
DROP POLICY IF EXISTS "Users can view training_info" ON training_info;
DROP POLICY IF EXISTS "Authenticated users can read training_info" ON training_info;
DROP POLICY IF EXISTS "Staff can manage training_info" ON training_info;
DROP POLICY IF EXISTS "Users can view training info in accessible facilities" ON training_info;
DROP POLICY IF EXISTS "Users can manage training info in accessible facilities" ON training_info;

CREATE POLICY "Users can view training info in accessible facilities" ON training_info
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert training info in accessible facilities" ON training_info
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update training info in accessible facilities" ON training_info
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete training info" ON training_info
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Personnel Info table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON personnel_info;
DROP POLICY IF EXISTS "Users can view personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Authenticated users can read personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Staff can manage personnel_info" ON personnel_info;
DROP POLICY IF EXISTS "Users can view personnel in accessible facilities" ON personnel_info;
DROP POLICY IF EXISTS "Users can manage personnel in accessible facilities" ON personnel_info;

CREATE POLICY "Users can view personnel info in accessible facilities" ON personnel_info
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert personnel info in accessible facilities" ON personnel_info
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update personnel info in accessible facilities" ON personnel_info
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete personnel info" ON personnel_info
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Trained Personnel table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON trained_personnel;
DROP POLICY IF EXISTS "Users can view trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Authenticated users can read trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Staff can manage trained_personnel" ON trained_personnel;
DROP POLICY IF EXISTS "Users can view trained personnel in accessible facilities" ON trained_personnel;
DROP POLICY IF EXISTS "Users can manage trained personnel in accessible facilities" ON trained_personnel;

CREATE POLICY "Users can view trained personnel in accessible facilities" ON trained_personnel
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert trained personnel in accessible facilities" ON trained_personnel
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update trained personnel in accessible facilities" ON trained_personnel
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete trained personnel" ON trained_personnel
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Documents table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON documents;
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON documents;
DROP POLICY IF EXISTS "Staff can manage documents" ON documents;
DROP POLICY IF EXISTS "Users can view documents in accessible facilities" ON documents;
DROP POLICY IF EXISTS "Users can manage documents in accessible facilities" ON documents;

CREATE POLICY "Users can view documents in accessible facilities" ON documents
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert documents in accessible facilities" ON documents
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update documents in accessible facilities" ON documents
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete documents" ON documents
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Integration Info table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON integration_info;
DROP POLICY IF EXISTS "Users can view integration_info" ON integration_info;
DROP POLICY IF EXISTS "Authenticated users can read integration_info" ON integration_info;
DROP POLICY IF EXISTS "Staff can manage integration_info" ON integration_info;
DROP POLICY IF EXISTS "Users can view integration info in accessible facilities" ON integration_info;
DROP POLICY IF EXISTS "Users can manage integration info in accessible facilities" ON integration_info;

CREATE POLICY "Users can view integration info in accessible facilities" ON integration_info
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert integration info in accessible facilities" ON integration_info
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update integration info in accessible facilities" ON integration_info
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete integration info" ON integration_info
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Facility Readiness Info table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can view facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Authenticated users can read facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Staff can manage facility_readiness_info" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can view readiness info in accessible facilities" ON facility_readiness_info;
DROP POLICY IF EXISTS "Users can manage readiness info in accessible facilities" ON facility_readiness_info;

CREATE POLICY "Users can view readiness info in accessible facilities" ON facility_readiness_info
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert readiness info in accessible facilities" ON facility_readiness_info
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update readiness info in accessible facilities" ON facility_readiness_info
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete readiness info" ON facility_readiness_info
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Notes table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON notes;
DROP POLICY IF EXISTS "Users can view notes" ON notes;
DROP POLICY IF EXISTS "Authenticated users can read notes" ON notes;
DROP POLICY IF EXISTS "Staff can manage notes" ON notes;
DROP POLICY IF EXISTS "Users can view notes in accessible facilities" ON notes;
DROP POLICY IF EXISTS "Users can manage notes in accessible facilities" ON notes;

CREATE POLICY "Users can view notes in accessible facilities" ON notes
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert notes in accessible facilities" ON notes
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update notes in accessible facilities" ON notes
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete notes" ON notes
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Activity Log table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON activity_log;
DROP POLICY IF EXISTS "Users can view activity_log" ON activity_log;
DROP POLICY IF EXISTS "Authenticated users can read activity_log" ON activity_log;
DROP POLICY IF EXISTS "Staff can manage activity_log" ON activity_log;
DROP POLICY IF EXISTS "Users can view activity log in accessible facilities" ON activity_log;
DROP POLICY IF EXISTS "Users can manage activity log in accessible facilities" ON activity_log;

CREATE POLICY "Users can view activity log in accessible facilities" ON activity_log
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert activity log in accessible facilities" ON activity_log
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can update activity log" ON activity_log
  FOR UPDATE USING (is_internal_user(auth.uid()));

CREATE POLICY "Internal users can delete activity log" ON activity_log
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Site Equipment table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON site_equipment;
DROP POLICY IF EXISTS "Users can view site_equipment" ON site_equipment;
DROP POLICY IF EXISTS "Authenticated users can read site_equipment" ON site_equipment;
DROP POLICY IF EXISTS "Staff can manage site_equipment" ON site_equipment;
DROP POLICY IF EXISTS "Users can view site equipment in accessible facilities" ON site_equipment;
DROP POLICY IF EXISTS "Users can manage site equipment in accessible facilities" ON site_equipment;

CREATE POLICY "Users can view site equipment in accessible facilities" ON site_equipment
  FOR SELECT USING (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can insert site equipment in accessible facilities" ON site_equipment
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can update site equipment in accessible facilities" ON site_equipment
  FOR UPDATE USING (user_can_access_facility(auth.uid(), site_id))
  WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Internal users can delete site equipment" ON site_equipment
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Site Test Menu table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON site_test_menu;
DROP POLICY IF EXISTS "Users can view site_test_menu" ON site_test_menu;
DROP POLICY IF EXISTS "Authenticated users can read site_test_menu" ON site_test_menu;
DROP POLICY IF EXISTS "Staff can manage site_test_menu" ON site_test_menu;
DROP POLICY IF EXISTS "Users can view site test menu in accessible facilities" ON site_test_menu;
DROP POLICY IF EXISTS "Users can manage site test menu in accessible facilities" ON site_test_menu;

CREATE POLICY "Users can view site test menu in accessible facilities" ON site_test_menu
  FOR SELECT USING (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can insert site test menu in accessible facilities" ON site_test_menu
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can update site test menu in accessible facilities" ON site_test_menu
  FOR UPDATE USING (user_can_access_facility(auth.uid(), site_id))
  WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Internal users can delete site test menu" ON site_test_menu
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Compliance Events table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON compliance_events;
DROP POLICY IF EXISTS "Users can view compliance_events" ON compliance_events;
DROP POLICY IF EXISTS "Authenticated users can read compliance_events" ON compliance_events;
DROP POLICY IF EXISTS "Staff can manage compliance_events" ON compliance_events;
DROP POLICY IF EXISTS "Users can view compliance events in accessible facilities" ON compliance_events;
DROP POLICY IF EXISTS "Users can manage compliance events in accessible facilities" ON compliance_events;

CREATE POLICY "Users can view compliance events in accessible facilities" ON compliance_events
  FOR SELECT USING (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can insert compliance events in accessible facilities" ON compliance_events
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can update compliance events in accessible facilities" ON compliance_events
  FOR UPDATE USING (user_can_access_facility(auth.uid(), site_id))
  WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Internal users can delete compliance events" ON compliance_events
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Deficiencies table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON deficiencies;
DROP POLICY IF EXISTS "Users can view deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Authenticated users can read deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Staff can manage deficiencies" ON deficiencies;
DROP POLICY IF EXISTS "Users can view deficiencies in accessible facilities" ON deficiencies;
DROP POLICY IF EXISTS "Users can manage deficiencies in accessible facilities" ON deficiencies;

CREATE POLICY "Users can view deficiencies in accessible facilities" ON deficiencies
  FOR SELECT USING (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can insert deficiencies in accessible facilities" ON deficiencies
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Users can update deficiencies in accessible facilities" ON deficiencies
  FOR UPDATE USING (user_can_access_facility(auth.uid(), site_id))
  WITH CHECK (user_can_access_facility(auth.uid(), site_id));

CREATE POLICY "Internal users can delete deficiencies" ON deficiencies
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Responsibilities table
DROP POLICY IF EXISTS "Public read access for authenticated users" ON responsibilities;
DROP POLICY IF EXISTS "Users can view responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Authenticated users can read responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Staff can manage responsibilities" ON responsibilities;
DROP POLICY IF EXISTS "Users can view responsibilities in accessible facilities" ON responsibilities;
DROP POLICY IF EXISTS "Users can manage responsibilities in accessible facilities" ON responsibilities;

CREATE POLICY "Users can view responsibilities in accessible facilities" ON responsibilities
  FOR SELECT USING (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can insert responsibilities in accessible facilities" ON responsibilities
  FOR INSERT WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Users can update responsibilities in accessible facilities" ON responsibilities
  FOR UPDATE USING (user_can_access_facility(auth.uid(), facility_id))
  WITH CHECK (user_can_access_facility(auth.uid(), facility_id));

CREATE POLICY "Internal users can delete responsibilities" ON responsibilities
  FOR DELETE USING (is_internal_user(auth.uid()));

-- Interface Status table (linked via integration_info)
DROP POLICY IF EXISTS "Public read access for authenticated users" ON interface_status;
DROP POLICY IF EXISTS "Users can view interface_status" ON interface_status;
DROP POLICY IF EXISTS "Authenticated users can read interface_status" ON interface_status;
DROP POLICY IF EXISTS "Staff can manage interface_status" ON interface_status;
DROP POLICY IF EXISTS "Users can view interface status" ON interface_status;
DROP POLICY IF EXISTS "Users can manage interface status" ON interface_status;

CREATE POLICY "Users can view interface status" ON interface_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM integration_info ii
      WHERE ii.id = interface_status.integration_info_id
      AND user_can_access_facility(auth.uid(), ii.facility_id)
    )
  );

CREATE POLICY "Users can insert interface status" ON interface_status
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM integration_info ii
      WHERE ii.id = interface_status.integration_info_id
      AND user_can_access_facility(auth.uid(), ii.facility_id)
    )
  );

CREATE POLICY "Users can update interface status" ON interface_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM integration_info ii
      WHERE ii.id = interface_status.integration_info_id
      AND user_can_access_facility(auth.uid(), ii.facility_id)
    )
  );

CREATE POLICY "Internal users can delete interface status" ON interface_status
  FOR DELETE USING (is_internal_user(auth.uid()));
