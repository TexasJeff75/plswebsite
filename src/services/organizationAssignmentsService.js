import { supabase } from '../lib/supabase';

export const organizationAssignmentsService = {
  async getAssignmentsForUser(userId) {
    const { data, error } = await supabase
      .from('user_organization_assignments')
      .select(`
        *,
        organization:organizations(id, name),
        assigned_by_user:assigned_by(id, email, raw_user_meta_data)
      `)
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAssignmentsForOrganization(organizationId) {
    const { data, error } = await supabase
      .from('user_organization_assignments')
      .select(`
        *,
        user_role:user_roles!inner(id, user_id, email, display_name, role)
      `)
      .eq('organization_id', organizationId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getUsersForOrganization(organizationId) {
    const { data: assignments, error } = await supabase
      .from('user_organization_assignments')
      .select('user_id')
      .eq('organization_id', organizationId);

    if (error) throw error;

    if (!assignments || assignments.length === 0) {
      return [];
    }

    const userIds = assignments.map(a => a.user_id);

    const { data: users, error: usersError } = await supabase
      .from('user_roles')
      .select('*')
      .in('user_id', userIds);

    if (usersError) throw usersError;

    return (users || []).map(user => {
      const assignment = assignments.find(a => a.user_id === user.user_id);
      return {
        ...user,
        org_role: assignment?.role,
        is_primary: assignment?.is_primary,
        assigned_at: assignment?.assigned_at
      };
    });
  },

  async assignUserToOrganization(userId, organizationId, role = 'viewer', isPrimary = false, assignedBy = null) {
    if (isPrimary) {
      await supabase
        .from('user_organization_assignments')
        .update({ is_primary: false })
        .eq('user_id', userId);
    }

    const { data, error } = await supabase
      .from('user_organization_assignments')
      .upsert({
        user_id: userId,
        organization_id: organizationId,
        role,
        is_primary: isPrimary,
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,organization_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAssignment(userId, organizationId, updates) {
    if (updates.is_primary) {
      await supabase
        .from('user_organization_assignments')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .neq('organization_id', organizationId);
    }

    const { data, error } = await supabase
      .from('user_organization_assignments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeAssignment(userId, organizationId) {
    const { error } = await supabase
      .from('user_organization_assignments')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (error) throw error;
  },

  async setUserOrganizations(userId, assignments, assignedBy = null) {
    const { error: deleteError } = await supabase
      .from('user_organization_assignments')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    if (assignments.length === 0) return [];

    const records = assignments.map(a => ({
      user_id: userId,
      organization_id: a.organization_id,
      role: a.role || 'viewer',
      is_primary: a.is_primary || false,
      assigned_by: assignedBy,
      assigned_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('user_organization_assignments')
      .insert(records)
      .select();

    if (error) throw error;
    return data;
  }
};
