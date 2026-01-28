import { supabase } from '../lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

export const dashboardService = {
  async getRevenueData() {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('id, name, monthly_service_fee, monthly_lis_saas_fee, actual_go_live, service_fee_start_date, overall_status')
      .not('actual_go_live', 'is', null);

    if (error) throw error;

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: format(date, 'MMM yyyy'),
        date: date,
        monthKey: format(date, 'yyyy-MM')
      });
    }

    return months.map(({ month, date, monthKey }) => {
      const monthEnd = endOfMonth(date);

      const activeFacilities = facilities.filter(f => {
        const goLiveDate = f.actual_go_live || f.service_fee_start_date;
        if (!goLiveDate) return false;
        return new Date(goLiveDate) <= monthEnd;
      });

      const mrr = activeFacilities.reduce((sum, f) => {
        return sum + (Number(f.monthly_service_fee) || 750) + (Number(f.monthly_lis_saas_fee) || 78);
      }, 0);

      return {
        name: month,
        mrr: mrr,
        sites: activeFacilities.length
      };
    });
  },

  async getDeploymentVelocity() {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('id, actual_go_live')
      .not('actual_go_live', 'is', null);

    if (error) throw error;

    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: format(date, 'MMM'),
        date: date,
        monthKey: format(date, 'yyyy-MM')
      });
    }

    return months.map(({ month, date, monthKey }) => {
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const deploymentsThisMonth = facilities.filter(f => {
        const goLiveDate = new Date(f.actual_go_live);
        return isWithinInterval(goLiveDate, { start: monthStart, end: monthEnd });
      }).length;

      return {
        name: month,
        deployments: deploymentsThisMonth
      };
    });
  },

  async getComplianceTrend() {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select(`
        id,
        name,
        regulatory_info(
          clia_certificate_received,
          pt_program_enrolled,
          state_license_required,
          state_license_number
        )
      `);

    if (error) throw error;

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      months.push({
        month: format(date, 'MMM'),
        date: date
      });
    }

    const baseScore = facilities.reduce((sum, f) => {
      const reg = f.regulatory_info;
      if (!reg) return sum;

      let score = 0;
      if (reg.clia_certificate_received) score += 40;
      if (reg.pt_program_enrolled) score += 30;
      if (!reg.state_license_required || reg.state_license_number) score += 30;

      return sum + score;
    }, 0);

    const avgScore = facilities.length > 0 ? Math.round(baseScore / facilities.length) : 0;

    return months.map(({ month }) => {
      return {
        name: month,
        score: avgScore
      };
    });
  },

  async getSitesByStatus() {
    const { data: facilities, error } = await supabase
      .from('facilities')
      .select('id, overall_status');

    if (error) throw error;

    const statusMap = {
      active: { name: 'Active', color: '#10b981' },
      in_progress: { name: 'Onboarding', color: '#f59e0b' },
      blocked: { name: 'Blocked', color: '#ef4444' },
      not_started: { name: 'Not Started', color: '#64748b' },
      pending: { name: 'Not Started', color: '#64748b' },
      completed: { name: 'Active', color: '#10b981' }
    };

    const counts = facilities.reduce((acc, f) => {
      const status = f.overall_status || 'not_started';
      const mapped = statusMap[status] || statusMap.not_started;
      const key = mapped.name;

      if (!acc[key]) {
        acc[key] = { name: key, value: 0, color: mapped.color };
      }
      acc[key].value++;

      return acc;
    }, {});

    return Object.values(counts);
  },

  async getSitesByClient() {
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        client_type,
        facilities(id)
      `)
      .eq('type', 'customer');

    if (error) throw error;

    return organizations
      .map(org => ({
        name: org.name.length > 20 ? org.name.substring(0, 20) + '...' : org.name,
        fullName: org.name,
        sites: org.facilities?.length || 0,
        type: org.client_type || 'standard'
      }))
      .filter(org => org.sites > 0)
      .sort((a, b) => b.sites - a.sites)
      .slice(0, 10);
  },

  async getDashboardStats() {
    const { data: facilities, error: facError } = await supabase
      .from('facilities')
      .select('id, overall_status, actual_go_live, monthly_service_fee, monthly_lis_saas_fee');

    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('type', 'customer');

    if (facError) throw facError;
    if (orgError) throw orgError;

    const activeSites = facilities.filter(f =>
      f.overall_status === 'active' || f.overall_status === 'completed' || f.actual_go_live
    );

    const mrr = activeSites.reduce((sum, f) => {
      return sum + (Number(f.monthly_service_fee) || 750) + (Number(f.monthly_lis_saas_fee) || 78);
    }, 0);

    const onboarding = facilities.filter(f =>
      f.overall_status === 'in_progress' || f.overall_status === 'pending'
    ).length;

    return {
      totalClients: organizations?.length || 0,
      totalSites: facilities?.length || 0,
      activeSites: activeSites.length,
      onboarding,
      mrr
    };
  }
};
