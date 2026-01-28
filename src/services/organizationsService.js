import { supabase } from '../lib/supabase';

export const organizationsService = {
  async getAll() {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getWithStats() {
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .eq('type', 'customer')
      .order('name');

    if (orgsError) throw orgsError;

    const orgsWithStats = await Promise.all(
      orgs.map(async (org) => {
        const [facilitiesRes, ticketsRes] = await Promise.all([
          supabase
            .from('facilities')
            .select('id, deployment_phase, last_compliance_review_date, site_configuration')
            .eq('organization_id', org.id),
          supabase
            .from('support_tickets')
            .select('id, status, priority')
            .eq('organization_id', org.id)
        ]);

        const facilities = facilitiesRes.data || [];
        const tickets = ticketsRes.data || [];

        const liveFacilities = facilities.filter(f => f.deployment_phase === 'live').length;
        const totalFacilities = facilities.length;

        const openTickets = tickets.filter(t =>
          ['open', 'in_progress'].includes(t.status)
        ).length;

        const criticalTickets = tickets.filter(t =>
          t.priority === 'critical' && ['open', 'in_progress'].includes(t.status)
        ).length;

        const facilitiesWithCompliance = facilities.filter(f =>
          f.last_compliance_review_date
        ).length;
        const complianceScore = totalFacilities > 0
          ? Math.round((facilitiesWithCompliance / totalFacilities) * 100)
          : 0;

        return {
          ...org,
          totalFacilities,
          liveFacilities,
          openTickets,
          criticalTickets,
          complianceScore
        };
      })
    );

    return orgsWithStats;
  },

  async create(organization) {
    const { data, error } = await supabase
      .from('organizations')
      .insert(organization)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('organizations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
