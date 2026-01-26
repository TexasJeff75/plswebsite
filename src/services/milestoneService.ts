import { supabase } from '../lib/supabase';
import { Milestone } from '../types';

export const milestoneService = {
  async getByFacility(facilityId: string) {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('facility_id', facilityId)
      .order('milestone_order');

    if (error) throw error;
    return data as Milestone[];
  },

  async update(id: string, updates: Partial<Milestone>) {
    const { data, error } = await supabase
      .from('milestones')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Milestone;
  },

  async updateStatus(id: string, status: string, date?: string) {
    const updates: Partial<Milestone> = { status };

    if (status === 'In Progress' && date) {
      updates.start_date = date;
    } else if (status === 'Complete' && date) {
      updates.completion_date = date;
    }

    return this.update(id, updates);
  },
};
