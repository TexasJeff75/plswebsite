import { supabase } from '../lib/supabase';

export const supportService = {
  async getTickets(filters = {}) {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.priority && filters.priority !== 'all') {
      query = query.eq('priority', filters.priority);
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Get unique organization and site IDs
    const orgIds = [...new Set(data.filter(t => t.organization_id).map(t => t.organization_id))];
    const siteIds = [...new Set(data.filter(t => t.site_id).map(t => t.site_id))];

    // Fetch organizations and sites in parallel
    const [orgsResult, sitesResult] = await Promise.all([
      orgIds.length > 0
        ? supabase.from('organizations').select('id, name').in('id', orgIds)
        : Promise.resolve({ data: [] }),
      siteIds.length > 0
        ? supabase.from('facilities').select('id, name, city, state').in('id', siteIds)
        : Promise.resolve({ data: [] })
    ]);

    // Create lookup maps
    const orgMap = (orgsResult.data || []).reduce((acc, org) => {
      acc[org.id] = org;
      return acc;
    }, {});

    const siteMap = (sitesResult.data || []).reduce((acc, site) => {
      acc[site.id] = site;
      return acc;
    }, {});

    // Attach organization and site data to tickets
    return data.map(ticket => ({
      ...ticket,
      organization: ticket.organization_id ? orgMap[ticket.organization_id] : null,
      site: ticket.site_id ? siteMap[ticket.site_id] : null
    }));
  },

  async getTicketById(id) {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching ticket:', error);
      throw error;
    }

    if (!data) return null;

    // Manually fetch organization data if it exists
    if (data.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', data.organization_id)
        .maybeSingle();
      if (orgData) {
        data.organization = orgData;
      }
    }

    // Manually fetch site data if it exists
    if (data.site_id) {
      const { data: siteData } = await supabase
        .from('facilities')
        .select('id, name, city, state')
        .eq('id', data.site_id)
        .maybeSingle();
      if (siteData) {
        data.site = siteData;
      }
    }

    // Fetch assignee data if assigned
    if (data.assigned_to) {
      const { data: assigneeData } = await supabase
        .from('user_roles')
        .select('user_id, display_name, email')
        .eq('user_id', data.assigned_to)
        .maybeSingle();
      if (assigneeData) {
        data.assignee = assigneeData;
      }
    }

    return data;
  },

  async getTicketMessages(ticketId) {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching ticket messages:', error);
      throw error;
    }

    // Manually fetch user data for each message
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: usersData } = await supabase
        .from('user_roles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      // Map user data to messages
      const userMap = (usersData || []).reduce((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {});

      return data.map(msg => ({
        ...msg,
        user: userMap[msg.user_id] || null
      }));
    }

    return data || [];
  },

  async createTicket(ticketData) {
    const ticketNumber = await this.generateTicketNumber();

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        ...ticketData,
        ticket_number: ticketNumber,
        created_by: user.id,
        status: 'open',
        sla_deadline: this.calculateSLADeadline(ticketData.priority)
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTicket(id, updates) {
    const updateData = { ...updates, updated_at: new Date().toISOString() };

    if (updates.status === 'resolved' && !updates.resolved_at) {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addMessage(ticketId, message, isInternal = false) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        message,
        is_internal: isInternal
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error adding message:', error);
      throw error;
    }

    // Fetch user data separately from user_roles
    const { data: userData } = await supabase
      .from('user_roles')
      .select('user_id, display_name, email')
      .eq('user_id', user.id)
      .single();

    // Update ticket timestamp
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId);

    return {
      ...data,
      user: userData || null
    };
  },

  async generateTicketNumber() {
    const { count, error } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const nextNumber = (count || 0) + 1;
    return `TKT-${String(nextNumber).padStart(4, '0')}`;
  },

  calculateSLADeadline(priority) {
    const now = new Date();
    const hoursMap = {
      critical: 4,
      high: 8,
      normal: 24,
      low: 72
    };
    const hours = hoursMap[priority] || 24;
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  },

  async getStats() {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('status, priority, created_at, resolved_at, sla_deadline');

    if (error) throw error;

    const tickets = data || [];
    const now = new Date();

    const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const critical = tickets.filter(t => t.priority === 'critical' && t.status !== 'closed' && t.status !== 'resolved').length;

    const resolvedTickets = tickets.filter(t => t.resolved_at && t.created_at);
    let avgResponseTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at);
        const resolved = new Date(t.resolved_at);
        return sum + (resolved - created);
      }, 0);
      avgResponseTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60));
    }

    const ticketsWithSLA = tickets.filter(t => t.sla_deadline);
    const withinSLA = ticketsWithSLA.filter(t => {
      if (t.resolved_at) {
        return new Date(t.resolved_at) <= new Date(t.sla_deadline);
      }
      return new Date(t.sla_deadline) > now;
    }).length;
    const slaCompliance = ticketsWithSLA.length > 0
      ? Math.round((withinSLA / ticketsWithSLA.length) * 100)
      : 100;

    return {
      open,
      critical,
      avgResponseTime,
      slaCompliance
    };
  },

  async getStaffUsers() {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, display_name, email, role')
      .in('role', ['Proximity Admin', 'Proximity Staff', 'Technical Consultant', 'Account Manager']);

    if (error) throw error;
    return data || [];
  }
};
