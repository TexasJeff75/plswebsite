import { supabase } from '../lib/supabase';

export const auditService = {
  async getActivityLog(facilityId, limit = 100, offset = 0) {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('facility_id', facilityId)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Format the response to include user display name
    return (data || []).map(log => ({
      ...log,
      user: log.user_display_name || 'System'
    }));
  },

  async getActivityLogCount(facilityId) {
    const { count, error } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('facility_id', facilityId);

    if (error) throw error;
    return count || 0;
  },

  async logChange(facilityId, action, fieldName, oldValue, newValue, userId) {
    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        facility_id: facilityId,
        action,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getActivityLogByField(facilityId, fieldName) {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('facility_id', facilityId)
      .eq('field_name', fieldName)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActivityLogByDateRange(facilityId, startDate, endDate) {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('facility_id', facilityId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getProjectActivityLog(facilityIds, limit = 50, offset = 0) {
    if (!facilityIds?.length) return [];
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .in('facility_id', facilityIds)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []).map(log => ({
      ...log,
      user: log.user_display_name || 'System'
    }));
  },

  async getProjectActivityLogCount(facilityIds) {
    if (!facilityIds?.length) return 0;
    const { count, error } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .in('facility_id', facilityIds);

    if (error) throw error;
    return count || 0;
  },

  formatActivityEntry(entry, users = {}) {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const userName = users[entry.user_id]?.display_name || 'Unknown User';

    return {
      ...entry,
      formattedTimestamp: timestamp,
      userName,
      displayText: `${userName} ${entry.action} ${entry.field_name}`,
    };
  },

  async logImpersonationStart(adminUserId, targetUserId, targetUserEmail) {
    try {
      await supabase
        .from('activity_log')
        .insert({
          action: 'impersonation_start',
          field_name: 'impersonation',
          old_value: null,
          new_value: JSON.stringify({
            admin_user_id: adminUserId,
            target_user_id: targetUserId,
            target_user_email: targetUserEmail,
          }),
          user_id: adminUserId,
        });
    } catch (error) {
      console.error('Error logging impersonation start:', error);
    }
  },

  async logImpersonationStop(adminUserId, targetUserId) {
    try {
      await supabase
        .from('activity_log')
        .insert({
          action: 'impersonation_stop',
          field_name: 'impersonation',
          old_value: JSON.stringify({ target_user_id: targetUserId }),
          new_value: null,
          user_id: adminUserId,
        });
    } catch (error) {
      console.error('Error logging impersonation stop:', error);
    }
  },
};
