import { supabase } from '../lib/supabase';

export const projectsService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('projects')
      .select(`
        *,
        organization:organizations(id, name, type)
      `)
      .order('created_at', { ascending: false });

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        organization:organizations(id, name, type, contact_email, contact_phone),
        facilities(id, name, status, city, state)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getByOrganization(organizationId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async create(project) {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getStats(projectId) {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('id, status')
      .eq('project_id', projectId);

    if (error) throw error;

    const total = facilities?.length || 0;
    const live = facilities?.filter(f => f.status === 'Live').length || 0;
    const inProgress = facilities?.filter(f => f.status === 'In Progress').length || 0;
    const notStarted = facilities?.filter(f => f.status === 'Not Started').length || 0;
    const blocked = facilities?.filter(f => f.status === 'Blocked').length || 0;

    return {
      total,
      live,
      inProgress,
      notStarted,
      blocked,
      completionRate: total > 0 ? Math.round((live / total) * 100) : 0
    };
  }
};
