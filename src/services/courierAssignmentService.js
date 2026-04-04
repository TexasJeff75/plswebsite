import { supabase } from '../lib/supabase';

export const courierAssignmentService = {
  async getByFacility(facilityId) {
    const { data, error } = await supabase
      .from('courier_facility_assignments')
      .select(`
        id,
        courier_user_id,
        facility_id,
        assigned_by,
        assigned_at,
        is_active,
        courier:user_roles!fk_courier_assignments_user_roles(id, user_id, display_name, email, role)
      `)
      .eq('facility_id', facilityId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveCourierForFacility(facilityId) {
    const { data, error } = await supabase
      .from('courier_facility_assignments')
      .select(`
        id,
        courier_user_id,
        courier:user_roles!fk_courier_assignments_user_roles(id, user_id, display_name, email, role)
      `)
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async assignCourier(facilityId, courierUserId, assignedBy) {
    await supabase
      .from('courier_facility_assignments')
      .update({ is_active: false })
      .eq('facility_id', facilityId)
      .eq('is_active', true);

    const { data: existing } = await supabase
      .from('courier_facility_assignments')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('courier_user_id', courierUserId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('courier_facility_assignments')
        .update({ is_active: true, assigned_by: assignedBy, assigned_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('courier_facility_assignments')
      .insert({
        facility_id: facilityId,
        courier_user_id: courierUserId,
        assigned_by: assignedBy,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deactivate(id) {
    const { error } = await supabase
      .from('courier_facility_assignments')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  async getAllCouriers() {
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, user_id, display_name, email, role')
      .eq('role', 'Courier')
      .order('display_name');

    if (error) throw error;
    return data || [];
  },
};
