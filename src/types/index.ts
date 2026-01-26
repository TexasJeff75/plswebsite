export type FacilityStatus = 'Not Started' | 'In Progress' | 'Live' | 'Blocked';
export type MilestoneStatus = 'Not Started' | 'In Progress' | 'Complete' | 'Blocked';
export type EquipmentStatus = 'Ordered' | 'Shipped' | 'Delivered' | 'Installed' | 'Validated' | 'Trained';
export type Phase = 'Phase 1' | 'Phase 2' | 'Phase 3';
export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type ResponsibilityType = 'Facility Manager' | 'Site Assessor' | 'Equipment Installer' | 'Trainer' | 'Project Manager';
export type DocumentType = 'CLIA Certificate' | 'Training Records' | 'Compliance Documents' | 'Photos' | 'Other';

export interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  region: string;
  phase: Phase;
  status: FacilityStatus;
  projected_go_live: string | null;
  actual_go_live: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Milestone {
  id: string;
  facility_id: string;
  milestone_name: string;
  milestone_order: number;
  status: MilestoneStatus;
  start_date: string | null;
  completion_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  facility_id: string;
  device_type: string;
  device_name: string;
  status: EquipmentStatus;
  ordered_date: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  installed_date: string | null;
  validated_date: string | null;
  trained_date: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  facility_id: string;
  milestone_id: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  facility_id: string;
  milestone_id: string | null;
  document_name: string;
  document_type: DocumentType;
  document_url: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: UserRole;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Responsibility {
  id: string;
  facility_id: string;
  milestone_id: string | null;
  user_id: string;
  responsibility_type: ResponsibilityType;
  notes: string | null;
  assigned_by: string | null;
  assigned_at: string;
}

export interface DashboardMetrics {
  totalFacilities: number;
  notStarted: number;
  inProgress: number;
  live: number;
  blocked: number;
  completionPercentage: number;
  goLiveThisMonth: number;
  blockedItems: number;
}
