export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      facilities: {
        Row: {
          id: string;
          name: string;
          address: string;
          city: string;
          state: string;
          zip: string;
          county: string | null;
          region: string;
          phase: string;
          status: string;
          projected_go_live: string | null;
          actual_go_live: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          city: string;
          state: string;
          zip: string;
          county?: string | null;
          region: string;
          phase?: string;
          status?: string;
          projected_go_live?: string | null;
          actual_go_live?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          city?: string;
          state?: string;
          zip?: string;
          county?: string | null;
          region?: string;
          phase?: string;
          status?: string;
          projected_go_live?: string | null;
          actual_go_live?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      milestones: {
        Row: {
          id: string;
          facility_id: string;
          milestone_name: string;
          milestone_order: number;
          status: string;
          start_date: string | null;
          completion_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          milestone_name: string;
          milestone_order: number;
          status?: string;
          start_date?: string | null;
          completion_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          milestone_name?: string;
          milestone_order?: number;
          status?: string;
          start_date?: string | null;
          completion_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      equipment: {
        Row: {
          id: string;
          facility_id: string;
          device_type: string;
          device_name: string;
          status: string;
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
        };
        Insert: {
          id?: string;
          facility_id: string;
          device_type: string;
          device_name: string;
          status?: string;
          ordered_date?: string | null;
          shipped_date?: string | null;
          delivered_date?: string | null;
          installed_date?: string | null;
          validated_date?: string | null;
          trained_date?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          device_type?: string;
          device_name?: string;
          status?: string;
          ordered_date?: string | null;
          shipped_date?: string | null;
          delivered_date?: string | null;
          installed_date?: string | null;
          validated_date?: string | null;
          trained_date?: string | null;
          serial_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notes: {
        Row: {
          id: string;
          facility_id: string;
          milestone_id: string | null;
          content: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          milestone_id?: string | null;
          content: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          milestone_id?: string | null;
          content?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          facility_id: string;
          milestone_id: string | null;
          document_name: string;
          document_type: string;
          document_url: string;
          file_size: number | null;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          milestone_id?: string | null;
          document_name: string;
          document_type?: string;
          document_url: string;
          file_size?: number | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          milestone_id?: string | null;
          document_name?: string;
          document_type?: string;
          document_url?: string;
          file_size?: number | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          email: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: string;
          email: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          email?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      responsibilities: {
        Row: {
          id: string;
          facility_id: string;
          milestone_id: string | null;
          user_id: string;
          responsibility_type: string;
          notes: string | null;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          facility_id: string;
          milestone_id?: string | null;
          user_id: string;
          responsibility_type: string;
          notes?: string | null;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          facility_id?: string;
          milestone_id?: string | null;
          user_id?: string;
          responsibility_type?: string;
          notes?: string | null;
          assigned_by?: string | null;
          assigned_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
