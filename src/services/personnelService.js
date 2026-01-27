import { supabase } from '../lib/supabase';

export const personnelService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('personnel_info')
      .select('*')
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(facilityId, personnelData) {
    const existingData = await this.getByFacilityId(facilityId);

    if (existingData) {
      const { data, error } = await supabase
        .from('personnel_info')
        .update({
          ...personnelData,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', facilityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('personnel_info')
        .insert({
          facility_id: facilityId,
          ...personnelData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Trained Personnel Operations
  async getTrainedPersonnel(facilityId) {
    const { data, error } = await supabase
      .from('trained_personnel')
      .select('*')
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addTrainedPerson(facilityId, personData) {
    const { data, error } = await supabase
      .from('trained_personnel')
      .insert({
        facility_id: facilityId,
        ...personData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTrainedPerson(personId, personData) {
    const { data, error } = await supabase
      .from('trained_personnel')
      .update({
        ...personData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', personId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTrainedPerson(personId) {
    const { error } = await supabase
      .from('trained_personnel')
      .delete()
      .eq('id', personId);

    if (error) throw error;
  },

  async updateLabDirector(facilityId, labDirectorData) {
    return this.upsert(facilityId, labDirectorData);
  },

  async updateTechnicalConsultant(facilityId, consultantData) {
    return this.upsert(facilityId, consultantData);
  },
};
