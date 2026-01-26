import { supabase } from '../lib/supabase';

export const milestonesService = {
  async updateStatus(id, status, blockedReason = null) {
    const updates = { status };

    if (status === 'Blocked') {
      updates.notes = blockedReason;
    }

    if (status === 'Complete' && !updates.completion_date) {
      updates.completion_date = new Date().toISOString().split('T')[0];
    }

    if (status === 'In Progress' && !updates.start_date) {
      updates.start_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateDates(id, startDate, completionDate) {
    const { data, error } = await supabase
      .from('milestones')
      .update({
        start_date: startDate,
        completion_date: completionDate
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export const notesService = {
  async create(facilityId, content, milestoneId = null) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('notes')
      .insert([{
        facility_id: facilityId,
        milestone_id: milestoneId,
        content,
        created_by: user?.id
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

export const equipmentService = {
  async updateStatus(id, status) {
    const updates = { status };

    const dateField = {
      'Shipped': 'shipped_date',
      'Delivered': 'delivered_date',
      'Installed': 'installed_date',
      'Validated': 'validated_date',
      'Trained': 'trained_date'
    }[status];

    if (dateField) {
      updates[dateField] = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('equipment')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
