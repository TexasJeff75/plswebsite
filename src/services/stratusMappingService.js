import { supabase } from '../lib/supabase';

export const stratusMappingService = {
  async getMappings(filters = {}) {
    let query = supabase
      .from('stratus_facility_mappings')
      .select(`
        *,
        organization:organizations(id, name),
        facility:facilities(id, name, address, city, state)
      `)
      .order('created_at', { ascending: false });

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.facility_id) {
      query = query.eq('facility_id', filters.facility_id);
    }

    if (filters.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  async getMappingById(id) {
    const { data, error } = await supabase
      .from('stratus_facility_mappings')
      .select(`
        *,
        organization:organizations(id, name),
        facility:facilities(id, name, address, city, state)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async createMapping(mapping) {
    const { data, error } = await supabase
      .from('stratus_facility_mappings')
      .insert({
        organization_id: mapping.organization_id,
        facility_id: mapping.facility_id || null,
        stratus_facility_identifier: mapping.stratus_facility_identifier,
        stratus_organization_identifier: mapping.stratus_organization_identifier || null,
        mapping_type: mapping.mapping_type || 'exact',
        is_active: mapping.is_active !== undefined ? mapping.is_active : true,
        notes: mapping.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateMapping(id, updates) {
    const { data, error } = await supabase
      .from('stratus_facility_mappings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteMapping(id) {
    const { error } = await supabase
      .from('stratus_facility_mappings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id, isActive) {
    const { data, error } = await supabase
      .from('stratus_facility_mappings')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async testMapping(facilityIdentifier, organizationIdentifier = null) {
    const { data, error } = await supabase
      .rpc('find_stratus_facility_mapping', {
        p_facility_identifier: facilityIdentifier,
        p_organization_identifier: organizationIdentifier,
      });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  async getMappingStats() {
    const { data: mappings, error } = await supabase
      .from('stratus_facility_mappings')
      .select('is_active, match_count');

    if (error) throw error;

    const stats = {
      total: mappings.length,
      active: mappings.filter(m => m.is_active).length,
      inactive: mappings.filter(m => !m.is_active).length,
      total_matches: mappings.reduce((sum, m) => sum + (m.match_count || 0), 0),
    };

    return stats;
  },

  async bulkCreateMappings(mappings) {
    const { data, error } = await supabase
      .from('stratus_facility_mappings')
      .insert(mappings)
      .select();

    if (error) throw error;
    return data;
  },
};
