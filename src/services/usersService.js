import { supabase } from '../lib/supabase';

const INTERNAL_ROLES = ['Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'];

export const usersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        *,
        organization_assignments:user_organization_assignments!user_id(
          id,
          organization_id,
          role,
          is_primary,
          organization:organizations(id, name, type)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        *,
        organization_assignments:user_organization_assignments!user_id(
          id,
          organization_id,
          role,
          is_primary,
          organization:organizations(id, name, type)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByUserId(userId) {
    const { data, error} = await supabase
      .from('user_roles')
      .select(`
        *,
        organization_assignments:user_organization_assignments!user_id(
          id,
          organization_id,
          role,
          is_primary,
          organization:organizations(id, name, type)
        )
      `)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (updates.role) {
      updateData.is_internal = INTERNAL_ROLES.includes(updates.role);
    }

    const { data, error } = await supabase
      .from('user_roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
