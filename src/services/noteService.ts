import { supabase } from '../lib/supabase';
import { Note } from '../types';

export const noteService = {
  async getByFacility(facilityId: string) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Note[];
  },

  async create(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('notes')
      .insert({ ...note, created_by: user?.id })
      .select()
      .single();

    if (error) throw error;
    return data as Note;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
