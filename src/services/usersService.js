import { supabase } from '../lib/supabase';

const INTERNAL_ROLES = ['Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'];

export const usersService = {
  async getAll() {
    const { data: users, error: usersError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_organization_assignments')
      .select(`
        id,
        user_id,
        organization_id,
        role,
        is_primary,
        organization:organizations(id, name, type)
      `);

    if (assignmentsError) throw assignmentsError;

    const usersWithAssignments = users.map(user => ({
      ...user,
      organization_assignments: assignments?.filter(a => a.user_id === user.user_id) || []
    }));

    return usersWithAssignments;
  },

  async getById(id) {
    const { data: user, error: userError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return null;

    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_organization_assignments')
      .select(`
        id,
        organization_id,
        role,
        is_primary,
        organization:organizations(id, name, type)
      `)
      .eq('user_id', user.user_id);

    if (assignmentsError) throw assignmentsError;

    return {
      ...user,
      organization_assignments: assignments || []
    };
  },

  async getByUserId(userId) {
    const { data: user, error: userError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return null;

    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_organization_assignments')
      .select(`
        id,
        organization_id,
        role,
        is_primary,
        organization:organizations(id, name, type)
      `)
      .eq('user_id', userId);

    if (assignmentsError) throw assignmentsError;

    return {
      ...user,
      organization_assignments: assignments || []
    };
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
