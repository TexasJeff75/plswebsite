import { supabase } from '../lib/supabase';

export const facilitiesService = {
  async getAll(filters = {}) {
    let query = supabase
      .from('facilities')
      .select(`
        *,
        organization:organizations(id, name),
        project:projects(id, name),
        milestones(id, status, milestone_order),
        equipment(id, status)
      `)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.region) {
      query = query.eq('region', filters.region);
    }

    if (filters.phase) {
      query = query.eq('phase', filters.phase);
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('facilities')
      .select(`
        *,
        organization:organizations(id, name),
        project:projects(id, name),
        milestones(*),
        equipment(*),
        notes(*),
        documents(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching facility:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Facility not found');
    }

    return data;
  },

  async create(facility) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('facilities')
      .insert([{
        ...facility,
        created_by: user?.id,
        updated_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('facilities')
      .update({
        ...updates,
        updated_by: user?.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getStats() {
    const { data, error } = await supabase
      .from('facilities')
      .select('status, phase');

    if (error) throw error;

    const stats = {
      total: data.length,
      byStatus: {},
      byPhase: {}
    };

    data.forEach(facility => {
      stats.byStatus[facility.status] = (stats.byStatus[facility.status] || 0) + 1;
      stats.byPhase[facility.phase] = (stats.byPhase[facility.phase] || 0) + 1;
    });

    return stats;
  },

  async getUpcomingGoLives() {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .gte('projected_go_live', today)
      .lte('projected_go_live', thirtyDaysFromNow)
      .order('projected_go_live', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getBlockedFacilities() {
    const { data, error } = await supabase
      .from('facilities')
      .select(`
        *,
        milestones!inner(*)
      `)
      .eq('milestones.status', 'Blocked');

    if (error) throw error;
    return data;
  },

  async createMilestone(milestone) {
    console.log('facilitiesService.createMilestone called with:', milestone);

    const { data, error } = await supabase
      .from('milestones')
      .insert([milestone])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating milestone:', error);
      throw error;
    }

    console.log('Milestone created, data returned:', data);
    return data;
  },

  async updateMilestone(id, updates) {
    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createEquipment(equipment) {
    const { data, error } = await supabase
      .from('equipment')
      .insert([equipment])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEquipment(id, updates) {
    const { data, error } = await supabase
      .from('equipment')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async uploadEquipmentImage(facilityId, equipmentId, file) {
    const storagePath = `${facilityId}/${equipmentId}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('equipment-images')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from('equipment')
      .update({ image_storage_path: storagePath })
      .eq('id', equipmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getEquipmentImageUrl(storagePath) {
    if (!storagePath) return null;

    const { data } = await supabase.storage
      .from('equipment-images')
      .createSignedUrl(storagePath, 3600);

    return data?.signedUrl || null;
  },

  async deleteEquipmentImage(equipmentId, storagePath) {
    if (storagePath) {
      await supabase.storage
        .from('equipment-images')
        .remove([storagePath]);
    }

    const { data, error } = await supabase
      .from('equipment')
      .update({ image_storage_path: null })
      .eq('id', equipmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
