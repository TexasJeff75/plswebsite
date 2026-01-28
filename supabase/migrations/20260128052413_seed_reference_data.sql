/*
  # Seed Initial Reference Data

  Populates reference_data table with all standard dropdown values:
  
  1. Core Types
    - configuration_type: CLIA waived, moderate, high complexity
    - facility_type: SNF, ALF, Hospital, Clinic, etc.
    - organization_type: Mini Lab Network, Hosted Lab, Hybrid

  2. Equipment
    - equipment_type: GeneXpert, Clarity, epoc, Abacus, Laptop
    - equipment_status: Not Ordered through Operational workflow

  3. Milestones
    - milestone_category: Regulatory, Equipment, Integration, Training, Go-Live
    - milestone_status: Not Started, In Progress, Complete, Blocked, N/A
    - responsible_party: Proximity, Client, Facility, Vendor
    - deployment_phase: Phase 1a, 1b, 2, 3

  4. Support
    - ticket_priority: Critical, High, Normal, Low with SLA hours
    - ticket_status: Open, In Progress, Pending Client, Resolved, Closed
    - ticket_category: Equipment, LIS/Integration, Compliance, Training, Billing, Other

  5. Compliance
    - clia_certificate_type: Waiver, Compliance, Accreditation, Registration
    - accreditation_body: CAP, COLA, TJC, AABB
    - pt_provider: CAP, API, WSLH

  6. Integration
    - lis_provider: StratusDX, Orchard, Sunquest, Cerner, Epic

  7. System
    - user_role: Admin through Viewer
    - notification_type: Various notification categories
    - us_state: All 50 states + DC
*/

-- Configuration Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('configuration_type', 'waived', 'CLIA Waived', 'CLIA Waived testing only', 1, true, '#10b981'),
('configuration_type', 'moderate', 'Moderate Complexity', 'Moderate complexity testing', 2, true, '#8b5cf6'),
('configuration_type', 'high', 'High Complexity', 'High complexity testing', 3, true, '#f59e0b')
ON CONFLICT (category, code) DO NOTHING;

-- Facility Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('facility_type', 'snf', 'SNF', 'Skilled Nursing Facility', 1, true),
('facility_type', 'alf', 'ALF', 'Assisted Living Facility', 2, true),
('facility_type', 'hospital', 'Hospital', 'Acute Care Hospital', 3, true),
('facility_type', 'clinic', 'Clinic', 'Outpatient Clinic', 4, false),
('facility_type', 'urgent_care', 'Urgent Care', 'Urgent Care Center', 5, false),
('facility_type', 'physician_office', 'Physician Office', 'Physician Office Lab', 6, false),
('facility_type', 'reference_lab', 'Reference Lab', 'Reference Laboratory', 7, false)
ON CONFLICT (category, code) DO NOTHING;

-- Organization Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('organization_type', 'mini_lab_network', 'Mini Lab Network', 'Distributed POC testing network', 1, true, '#10b981'),
('organization_type', 'hosted_lab', 'Hosted Lab', 'Traditional lab hosting', 2, true, '#3b82f6'),
('organization_type', 'hybrid', 'Hybrid', 'Central lab + distributed sites', 3, true, '#8b5cf6')
ON CONFLICT (category, code) DO NOTHING;

-- Equipment Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('equipment_type', 'analyzer', 'Analyzer', 'Laboratory analyzer', 1, true),
('equipment_type', 'poc_device', 'POC Device', 'Point of care device', 2, true),
('equipment_type', 'genexpert', 'GeneXpert', 'Cepheid GeneXpert molecular diagnostics', 3, true),
('equipment_type', 'clarity', 'Clarity Platinum', 'Clarity Platinum urinalysis analyzer', 4, true),
('equipment_type', 'epoc', 'epoc Blood Gas', 'Siemens epoc blood gas analyzer', 5, true),
('equipment_type', 'abacus', 'Abacus CBC', 'Diatron Abacus hematology analyzer', 6, true),
('equipment_type', 'laptop', 'Laptop/Host', 'Dedicated site laptop', 7, true),
('equipment_type', 'printer', 'Printer', 'Label or report printer', 8, true),
('equipment_type', 'barcode_scanner', 'Barcode Scanner', 'Barcode scanner', 9, true),
('equipment_type', 'centrifuge', 'Centrifuge', 'Sample centrifuge', 10, true),
('equipment_type', 'refrigerator', 'Refrigerator', 'Reagent/sample refrigerator', 11, true),
('equipment_type', 'other', 'Other', 'Other equipment', 99, false)
ON CONFLICT (category, code) DO NOTHING;

-- Equipment Status
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('equipment_status', 'not_ordered', 'Not Ordered', 'Equipment not yet ordered', 1, true, '#6b7280'),
('equipment_status', 'ordered', 'Ordered', 'Order placed with vendor', 2, true, '#6b7280'),
('equipment_status', 'shipped', 'Shipped', 'In transit to facility', 3, true, '#3b82f6'),
('equipment_status', 'delivered', 'Delivered', 'Received at facility', 4, true, '#f59e0b'),
('equipment_status', 'installed', 'Installed', 'Physically installed', 5, true, '#8b5cf6'),
('equipment_status', 'validated', 'Validated', 'QC and calibration complete', 6, true, '#10b981'),
('equipment_status', 'operational', 'Operational', 'In clinical use', 7, true, '#10b981')
ON CONFLICT (category, code) DO NOTHING;

-- Milestone Categories
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('milestone_category', 'regulatory', 'Regulatory', 'CLIA, licensing, PT enrollment', 1, true, '#3b82f6'),
('milestone_category', 'equipment', 'Equipment', 'Ordering, shipping, installation', 2, true, '#8b5cf6'),
('milestone_category', 'integration', 'Integration', 'LIS, interfaces, connectivity', 3, true, '#f59e0b'),
('milestone_category', 'training', 'Training', 'Staff training and competency', 4, true, '#10b981'),
('milestone_category', 'go_live', 'Go-Live', 'Final readiness and launch', 5, true, '#ef4444'),
('milestone_category', 'custom', 'Custom', 'Custom milestone', 6, false, '#6b7280')
ON CONFLICT (category, code) DO NOTHING;

-- Milestone Status
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('milestone_status', 'not_started', 'Not Started', 'Work has not begun', 1, true, '#6b7280'),
('milestone_status', 'in_progress', 'In Progress', 'Currently being worked', 2, true, '#f59e0b'),
('milestone_status', 'complete', 'Complete', 'Successfully finished', 3, true, '#10b981'),
('milestone_status', 'blocked', 'Blocked', 'Cannot proceed due to dependency', 4, true, '#ef4444'),
('milestone_status', 'not_applicable', 'N/A', 'Does not apply to this facility', 5, true, '#6b7280')
ON CONFLICT (category, code) DO NOTHING;

-- Responsible Parties
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('responsible_party', 'proximity', 'Proximity', 'Proximity Lab Services', 1, true),
('responsible_party', 'ama', 'AMA', 'American Medical Associates', 2, false),
('responsible_party', 'client', 'Client', 'Client organization', 3, true),
('responsible_party', 'facility', 'Facility', 'Individual facility staff', 4, true),
('responsible_party', 'vendor', 'Vendor', 'Equipment or service vendor', 5, true)
ON CONFLICT (category, code) DO NOTHING;

-- Ticket Priority
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color, metadata) VALUES
('ticket_priority', 'critical', 'Critical', 'System down, immediate response needed', 1, true, '#ef4444', '{"sla_hours": 2}'),
('ticket_priority', 'high', 'High', 'Major issue affecting operations', 2, true, '#f59e0b', '{"sla_hours": 4}'),
('ticket_priority', 'normal', 'Normal', 'Standard support request', 3, true, '#3b82f6', '{"sla_hours": 24}'),
('ticket_priority', 'low', 'Low', 'Minor issue or enhancement request', 4, true, '#6b7280', '{"sla_hours": 72}')
ON CONFLICT (category, code) DO NOTHING;

-- Ticket Status
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system, color) VALUES
('ticket_status', 'open', 'Open', 'New ticket awaiting triage', 1, true, '#3b82f6'),
('ticket_status', 'in_progress', 'In Progress', 'Being actively worked', 2, true, '#f59e0b'),
('ticket_status', 'pending_client', 'Pending Client', 'Waiting for client response', 3, true, '#8b5cf6'),
('ticket_status', 'resolved', 'Resolved', 'Solution provided', 4, true, '#10b981'),
('ticket_status', 'closed', 'Closed', 'Ticket closed', 5, true, '#6b7280')
ON CONFLICT (category, code) DO NOTHING;

-- Ticket Categories
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('ticket_category', 'equipment', 'Equipment', 'Hardware issues, repairs, replacements', 1, true),
('ticket_category', 'lis', 'LIS/Integration', 'Interface, connectivity, data flow', 2, true),
('ticket_category', 'compliance', 'Compliance', 'CLIA, PT, regulatory questions', 3, true),
('ticket_category', 'training', 'Training', 'Training requests, competency', 4, true),
('ticket_category', 'billing', 'Billing', 'Invoices, payments, fees', 5, true),
('ticket_category', 'other', 'Other', 'General inquiries', 6, true)
ON CONFLICT (category, code) DO NOTHING;

-- CLIA Certificate Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('clia_certificate_type', 'waiver', 'Certificate of Waiver', 'CLIA waived testing only', 1, true),
('clia_certificate_type', 'compliance', 'Certificate of Compliance', 'Moderate or high complexity', 2, true),
('clia_certificate_type', 'accreditation', 'Certificate of Accreditation', 'Accredited by approved body', 3, true),
('clia_certificate_type', 'registration', 'Certificate of Registration', 'PPM procedures only', 4, true)
ON CONFLICT (category, code) DO NOTHING;

-- Deployment Phases
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('deployment_phase', 'planning', 'Planning', 'Initial planning phase', 1, true),
('deployment_phase', 'phase_1a', 'Phase 1a', 'Initial waived deployment', 2, false),
('deployment_phase', 'phase_1b', 'Phase 1b', 'Moderate complexity upgrade', 3, false),
('deployment_phase', 'phase_2', 'Phase 2', 'Second wave deployment', 4, false),
('deployment_phase', 'phase_3', 'Phase 3', 'Third wave deployment', 5, false),
('deployment_phase', 'live', 'Live', 'Operational and live', 6, true)
ON CONFLICT (category, code) DO NOTHING;

-- Accreditation Bodies
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('accreditation_body', 'cap', 'CAP', 'College of American Pathologists', 1, true),
('accreditation_body', 'cola', 'COLA', 'COLA Laboratory Accreditation', 2, true),
('accreditation_body', 'tjc', 'TJC', 'The Joint Commission', 3, true),
('accreditation_body', 'aabb', 'AABB', 'AABB (blood bank)', 4, true)
ON CONFLICT (category, code) DO NOTHING;

-- PT Providers
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('pt_provider', 'cap', 'CAP', 'College of American Pathologists', 1, true),
('pt_provider', 'api', 'API', 'American Proficiency Institute', 2, true),
('pt_provider', 'wslh', 'WSLH', 'Wisconsin State Lab of Hygiene', 3, true)
ON CONFLICT (category, code) DO NOTHING;

-- LIS Providers
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('lis_provider', 'stratusdx', 'StratusDX', 'StratusDX LIS', 1, false),
('lis_provider', 'orchard', 'Orchard', 'Orchard Harvest LIS', 2, false),
('lis_provider', 'sunquest', 'Sunquest', 'Sunquest LIS', 3, false),
('lis_provider', 'cerner', 'Cerner', 'Cerner PathNet', 4, false),
('lis_provider', 'epic', 'Epic', 'Epic Beaker', 5, false)
ON CONFLICT (category, code) DO NOTHING;

-- User Roles
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('user_role', 'proximity_admin', 'Proximity Admin', 'Full system access', 1, true),
('user_role', 'proximity_staff', 'Proximity Staff', 'Proximity internal staff', 2, true),
('user_role', 'account_manager', 'Account Manager', 'Client relationship management', 3, true),
('user_role', 'technical_consultant', 'Technical Consultant', 'Field technical support', 4, true),
('user_role', 'compliance_specialist', 'Compliance Specialist', 'Regulatory compliance', 5, true),
('user_role', 'customer_admin', 'Customer Admin', 'Client administrator', 6, true),
('user_role', 'customer_user', 'Customer User', 'Client standard user', 7, true),
('user_role', 'viewer', 'Viewer', 'Read-only access', 8, true)
ON CONFLICT (category, code) DO NOTHING;

-- Notification Types
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('notification_type', 'clia_expiring', 'CLIA Expiring', 'CLIA certificate expiration warning', 1, true),
('notification_type', 'pt_due', 'PT Due', 'Proficiency testing event due', 2, true),
('notification_type', 'competency_due', 'Competency Due', 'Staff competency assessment due', 3, true),
('notification_type', 'sla_warning', 'SLA Warning', 'Support ticket SLA approaching', 4, true),
('notification_type', 'milestone_blocked', 'Milestone Blocked', 'Deployment milestone blocked', 5, true),
('notification_type', 'ticket_assigned', 'Ticket Assigned', 'Support ticket assigned to you', 6, true),
('notification_type', 'general', 'General', 'General notification', 7, true)
ON CONFLICT (category, code) DO NOTHING;

-- Procurement Methods
INSERT INTO reference_data (category, code, display_name, description, sort_order, is_system) VALUES
('procurement_method', 'purchase', 'Purchase', 'Direct purchase', 1, true),
('procurement_method', 'reagent_rental', 'Reagent Rental', 'Reagent rental agreement', 2, true),
('procurement_method', 'lease', 'Lease', 'Equipment lease', 3, true),
('procurement_method', 'client_provided', 'Client Provided', 'Provided by client', 4, true)
ON CONFLICT (category, code) DO NOTHING;

-- US States
INSERT INTO reference_data (category, code, display_name, sort_order, is_system) VALUES
('us_state', 'AL', 'Alabama', 1, true),
('us_state', 'AK', 'Alaska', 2, true),
('us_state', 'AZ', 'Arizona', 3, true),
('us_state', 'AR', 'Arkansas', 4, true),
('us_state', 'CA', 'California', 5, true),
('us_state', 'CO', 'Colorado', 6, true),
('us_state', 'CT', 'Connecticut', 7, true),
('us_state', 'DE', 'Delaware', 8, true),
('us_state', 'DC', 'District of Columbia', 9, true),
('us_state', 'FL', 'Florida', 10, true),
('us_state', 'GA', 'Georgia', 11, true),
('us_state', 'HI', 'Hawaii', 12, true),
('us_state', 'ID', 'Idaho', 13, true),
('us_state', 'IL', 'Illinois', 14, true),
('us_state', 'IN', 'Indiana', 15, true),
('us_state', 'IA', 'Iowa', 16, true),
('us_state', 'KS', 'Kansas', 17, true),
('us_state', 'KY', 'Kentucky', 18, true),
('us_state', 'LA', 'Louisiana', 19, true),
('us_state', 'ME', 'Maine', 20, true),
('us_state', 'MD', 'Maryland', 21, true),
('us_state', 'MA', 'Massachusetts', 22, true),
('us_state', 'MI', 'Michigan', 23, true),
('us_state', 'MN', 'Minnesota', 24, true),
('us_state', 'MS', 'Mississippi', 25, true),
('us_state', 'MO', 'Missouri', 26, true),
('us_state', 'MT', 'Montana', 27, true),
('us_state', 'NE', 'Nebraska', 28, true),
('us_state', 'NV', 'Nevada', 29, true),
('us_state', 'NH', 'New Hampshire', 30, true),
('us_state', 'NJ', 'New Jersey', 31, true),
('us_state', 'NM', 'New Mexico', 32, true),
('us_state', 'NY', 'New York', 33, true),
('us_state', 'NC', 'North Carolina', 34, true),
('us_state', 'ND', 'North Dakota', 35, true),
('us_state', 'OH', 'Ohio', 36, true),
('us_state', 'OK', 'Oklahoma', 37, true),
('us_state', 'OR', 'Oregon', 38, true),
('us_state', 'PA', 'Pennsylvania', 39, true),
('us_state', 'RI', 'Rhode Island', 40, true),
('us_state', 'SC', 'South Carolina', 41, true),
('us_state', 'SD', 'South Dakota', 42, true),
('us_state', 'TN', 'Tennessee', 43, true),
('us_state', 'TX', 'Texas', 44, true),
('us_state', 'UT', 'Utah', 45, true),
('us_state', 'VT', 'Vermont', 46, true),
('us_state', 'VA', 'Virginia', 47, true),
('us_state', 'WA', 'Washington', 48, true),
('us_state', 'WV', 'West Virginia', 49, true),
('us_state', 'WI', 'Wisconsin', 50, true),
('us_state', 'WY', 'Wyoming', 51, true)
ON CONFLICT (category, code) DO NOTHING;
