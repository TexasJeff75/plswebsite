import { supabase } from '../lib/supabase';
import { Equipment } from '../types';

export const equipmentService = {
  async getByFacility(facilityId: string) {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('facility_id', facilityId)
      .order('device_type');

    if (error) throw error;
    return data as Equipment[];
  },

  async create(equipment: Omit<Equipment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('equipment')
      .insert(equipment)
      .select()
      .single();

    if (error) throw error;
    return data as Equipment;
  },

  async update(id: string, updates: Partial<Equipment>) {
    const { data, error } = await supabase
      .from('equipment')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Equipment;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
