import { supabase } from '../lib/supabase';
import { Facility } from '../types';

export const facilityService = {
  async getAll() {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('name');

    if (error) throw error;
    return data as Facility[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Facility | null;
  },

  async create(facility: Omit<Facility, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('facilities')
      .insert(facility)
      .select()
      .single();

    if (error) throw error;
    return data as Facility;
  },

  async update(id: string, updates: Partial<Facility>) {
    const { data, error } = await supabase
      .from('facilities')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Facility;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getMetrics() {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('status, projected_go_live');

    if (error) throw error;

    const total = facilities.length;
    const notStarted = facilities.filter(f => f.status === 'Not Started').length;
    const inProgress = facilities.filter(f => f.status === 'In Progress').length;
    const live = facilities.filter(f => f.status === 'Live').length;
    const blocked = facilities.filter(f => f.status === 'Blocked').length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const goLiveThisMonth = facilities.filter(f => {
      if (!f.projected_go_live) return false;
      const goLiveDate = new Date(f.projected_go_live);
      return goLiveDate >= startOfMonth && goLiveDate <= endOfMonth;
    }).length;

    const completionPercentage = total > 0 ? Math.round((live / total) * 100) : 0;

    return {
      totalFacilities: total,
      notStarted,
      inProgress,
      live,
      blocked,
      completionPercentage,
      goLiveThisMonth,
      blockedItems: blocked,
    };
  },
};
