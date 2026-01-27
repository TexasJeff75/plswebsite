import { supabase } from '../lib/supabase';

export const regulatoryService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('regulatory_info')
      .select('*')
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(facilityId, regulatoryData) {
    const existingData = await this.getByFacilityId(facilityId);

    if (existingData) {
      const { data, error } = await supabase
        .from('regulatory_info')
        .update({
          ...regulatoryData,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', facilityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('regulatory_info')
        .insert({
          facility_id: facilityId,
          ...regulatoryData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async updateCliaInfo(facilityId, cliaData) {
    return this.upsert(facilityId, cliaData);
  },

  async updatePTInfo(facilityId, ptData) {
    return this.upsert(facilityId, ptData);
  },

  async updateStateLicenseInfo(facilityId, licenseData) {
    return this.upsert(facilityId, licenseData);
  },
};
