import { supabase } from '../lib/supabase';

export const facilityReadinessService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('facility_readiness_info')
      .select('*')
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(facilityId, readinessData) {
    const existingData = await this.getByFacilityId(facilityId);

    if (existingData) {
      const { data, error } = await supabase
        .from('facility_readiness_info')
        .update({
          ...readinessData,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', facilityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('facility_readiness_info')
        .insert({
          facility_id: facilityId,
          ...readinessData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async updateInfrastructure(facilityId, infrastructureData) {
    return this.upsert(facilityId, infrastructureData);
  },

  async updateNetworkInfrastructure(facilityId, networkData) {
    return this.upsert(facilityId, networkData);
  },

  async updateSiteAssessment(facilityId, assessmentData) {
    return this.upsert(facilityId, assessmentData);
  },

  getReadinessScore(readinessInfo) {
    if (!readinessInfo) return 0;

    const checks = [
      readinessInfo.dedicated_space_identified,
      readinessInfo.electrical_outlets_available,
      readinessInfo.network_available,
      readinessInfo.refrigerator_available,
      readinessInfo.supply_storage_identified,
      readinessInfo.site_assessment_complete,
    ].filter(Boolean).length;

    return Math.round((checks / 6) * 100);
  },
};
