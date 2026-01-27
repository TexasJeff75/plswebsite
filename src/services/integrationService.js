import { supabase } from '../lib/supabase';

export const integrationService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('integration_info')
      .select('*')
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(facilityId, integrationData) {
    const existingData = await this.getByFacilityId(facilityId);

    if (existingData) {
      const { data, error } = await supabase
        .from('integration_info')
        .update({
          ...integrationData,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', facilityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('integration_info')
        .insert({
          facility_id: facilityId,
          ...integrationData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Interface Status Operations
  async getInterfaceStatus(integrationInfoId) {
    const { data, error } = await supabase
      .from('interface_status')
      .select('*')
      .eq('integration_info_id', integrationInfoId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async updateInterfaceStatus(interfaceId, statusData) {
    const { data, error } = await supabase
      .from('interface_status')
      .update({
        ...statusData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', interfaceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createInterfaceStatus(integrationInfoId, instrumentType, interfaceData) {
    const { data, error } = await supabase
      .from('interface_status')
      .insert({
        integration_info_id: integrationInfoId,
        instrument_type: instrumentType,
        ...interfaceData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateLisSetup(facilityId, lisData) {
    return this.upsert(facilityId, lisData);
  },

  async updateNetworkConfiguration(facilityId, networkData) {
    return this.upsert(facilityId, networkData);
  },

  async updateEhrIntegration(facilityId, ehrData) {
    return this.upsert(facilityId, ehrData);
  },
};
