import { supabase } from '../lib/supabase';

export const trainingService = {
  async getByFacilityId(facilityId) {
    const { data, error } = await supabase
      .from('training_info')
      .select('*')
      .eq('facility_id', facilityId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(facilityId, trainingData) {
    const existingData = await this.getByFacilityId(facilityId);

    if (existingData) {
      const { data, error } = await supabase
        .from('training_info')
        .update({
          ...trainingData,
          updated_at: new Date().toISOString(),
        })
        .eq('facility_id', facilityId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('training_info')
        .insert({
          facility_id: facilityId,
          ...trainingData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async updateInitialTraining(facilityId, trainingData) {
    return this.upsert(facilityId, trainingData);
  },

  async updateCompetencyAssessment(facilityId, assessmentData) {
    return this.upsert(facilityId, assessmentData);
  },

  async updateMaterialsProvided(facilityId, materialsData) {
    return this.upsert(facilityId, materialsData);
  },

  getTrainingCompletionScore(trainingInfo) {
    if (!trainingInfo) return 0;

    const checks = [
      trainingInfo.initial_training_complete,
      trainingInfo.competency_assessment_complete,
      trainingInfo.procedure_manual_provided,
      trainingInfo.emergency_contacts_provided,
      trainingInfo.qc_protocols_provided,
    ].filter(Boolean).length;

    return Math.round((checks / 5) * 100);
  },
};
