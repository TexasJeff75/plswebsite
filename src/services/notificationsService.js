import { supabase } from '../lib/supabase';

export const notificationsService = {
  async getAll({ page = 1, limit = 20, type = null, readStatus = null } = {}) {
    let query = supabase
      .from('notifications')
      .select(`
        *,
        organization:organizations(id, name),
        facility:facilities(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    if (readStatus !== null) {
      query = query.eq('read', readStatus);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      notifications: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async getRecent(limit = 10) {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        organization:organizations(id, name),
        facility:facilities(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getUnreadCount() {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) throw error;
  },

  async markAllAsRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (error) throw error;
  },

  async markMultipleAsRead(ids) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', ids);

    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteMultiple(ids) {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },

  async create(notification) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notification)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createForUser(userId, { type, title, message, link, organizationId, facilityId }) {
    return this.create({
      user_id: userId,
      type: type || 'general',
      title,
      message,
      link,
      organization_id: organizationId,
      facility_id: facilityId
    });
  },

  getTypeIcon(type) {
    const icons = {
      clia_expiring: { icon: 'Shield', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      pt_due: { icon: 'ClipboardCheck', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      competency_due: { icon: 'GraduationCap', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
      sla_warning: { icon: 'Clock', color: 'text-red-400', bg: 'bg-red-500/10' },
      milestone_blocked: { icon: 'AlertTriangle', color: 'text-orange-400', bg: 'bg-orange-500/10' },
      ticket_assigned: { icon: 'Ticket', color: 'text-teal-400', bg: 'bg-teal-500/10' },
      general: { icon: 'Bell', color: 'text-slate-400', bg: 'bg-slate-500/10' }
    };
    return icons[type] || icons.general;
  },

  getTypeLabel(type) {
    const labels = {
      clia_expiring: 'CLIA Expiring',
      pt_due: 'PT Due',
      competency_due: 'Competency Due',
      sla_warning: 'SLA Warning',
      milestone_blocked: 'Milestone Blocked',
      ticket_assigned: 'Ticket Assigned',
      general: 'General'
    };
    return labels[type] || 'General';
  }
};
