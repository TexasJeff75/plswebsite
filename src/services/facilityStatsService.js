import { supabase } from '../lib/supabase';

export const facilityStatsService = {
  async getStats(filters = {}) {
    try {
      let query = supabase
        .from('facilities')
        .select(`
          id,
          status,
          state,
          projected_go_live,
          milestones(id, status),
          facility_contacts(id)
        `);

      if (filters.organization_id) {
        query = query.eq('organization_id', filters.organization_id);
      }

      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }

      const { data: facilities, error } = await query;

      if (error) throw error;

      const totalFacilities = facilities.length;
      const liveFacilities = facilities.filter(f => f.status === 'Live').length;
      const inProgressFacilities = facilities.filter(f => f.status === 'In Progress').length;

      const totalProgress = facilities.reduce((sum, f) => {
        const milestones = f.milestones || [];
        if (milestones.length === 0) return sum;
        const completed = milestones.filter(m => m.status === 'complete').length;
        return sum + (completed / milestones.length) * 100;
      }, 0);
      const averageProgress = totalFacilities > 0 ? Math.round(totalProgress / totalFacilities) : 0;

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const upcomingGoLives = facilities.filter(f => {
        if (!f.projected_go_live) return false;
        const goLiveDate = new Date(f.projected_go_live);
        return goLiveDate >= new Date() && goLiveDate <= thirtyDaysFromNow;
      }).length;

      const statusCounts = facilities.reduce((acc, f) => {
        const status = f.status || 'Unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const byStatus = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const facilitiesWithContacts = facilities.filter(f => f.facility_contacts && f.facility_contacts.length > 0).length;
      const totalContacts = facilities.reduce((sum, f) => sum + (f.facility_contacts?.length || 0), 0);

      const uniqueStates = new Set(facilities.map(f => f.state).filter(Boolean)).size;

      return {
        totalFacilities,
        liveFacilities,
        inProgressFacilities,
        averageProgress,
        upcomingGoLives,
        byStatus,
        facilitiesWithContacts,
        totalContacts,
        uniqueStates
      };
    } catch (error) {
      console.error('Error fetching facility stats:', error);
      throw error;
    }
  },

  calculateCompletionPercentage(milestones) {
    if (!milestones || milestones.length === 0) return 0;

    const completedCount = milestones.filter(m => m.status === 'complete').length;
    return Math.round((completedCount / milestones.length) * 100);
  },

  calculateOverallStatus(facility) {
    if (!facility) return 'not_started';

    if (facility.actual_go_live_date) {
      return 'live';
    }

    const hasBlocked = facility.milestones?.some(m => m.status === 'blocked');
    if (hasBlocked) {
      return 'blocked';
    }

    const hasInProgress = facility.milestones?.some(m => m.status === 'in_progress');
    if (hasInProgress) {
      return 'in_progress';
    }

    return 'not_started';
  },

  getNextActionMilestone(milestones) {
    if (!milestones || milestones.length === 0) return null;

    const uncompleted = milestones.filter(m => m.status !== 'complete');
    if (uncompleted.length === 0) return null;

    const blocked = uncompleted.find(m => m.status === 'blocked');
    if (blocked) return blocked;

    const inProgress = uncompleted.find(m => m.status === 'in_progress');
    if (inProgress) return inProgress;

    return uncompleted[0];
  },

  getMilestonesByCategory(milestones) {
    if (!milestones) return {};

    const categories = ['regulatory', 'equipment', 'integration', 'training', 'go_live'];
    const grouped = {};

    categories.forEach(cat => {
      grouped[cat] = milestones.filter(m => m.category === cat);
    });

    return grouped;
  },

  getCategoryProgress(milestones, category) {
    const categoryMilestones = milestones?.filter(m => m.category === category) || [];
    if (categoryMilestones.length === 0) return 0;

    const completed = categoryMilestones.filter(m => m.status === 'complete').length;
    return Math.round((completed / categoryMilestones.length) * 100);
  },

  getUniqueCategoriesWithProgress(milestones) {
    if (!milestones || milestones.length === 0) return [];

    const categoryMap = new Map();

    milestones.forEach(milestone => {
      const category = milestone.category || 'uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          total: 0,
          completed: 0
        });
      }
      const stats = categoryMap.get(category);
      stats.total += 1;
      if (milestone.status === 'complete') {
        stats.completed += 1;
      }
    });

    const categoryOrder = {
      'regulatory': 1,
      'equipment': 2,
      'integration': 3,
      'training': 4,
      'go_live': 5,
      'custom': 6,
      'uncategorized': 999
    };

    const categoryLabels = {
      'regulatory': 'Regulatory',
      'equipment': 'Equipment',
      'integration': 'Integration',
      'training': 'Training',
      'go_live': 'Go-Live',
      'custom': 'Custom',
      'uncategorized': 'Uncategorized'
    };

    return Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        label: categoryLabels[category] || (category ? category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ') : 'Unknown'),
        progress: Math.round((stats.completed / stats.total) * 100),
        completed: stats.completed,
        total: stats.total
      }))
      .sort((a, b) => {
        const orderA = categoryOrder[a.category] || 999;
        const orderB = categoryOrder[b.category] || 999;
        return orderA - orderB;
      });
  },

  getBlockedMilestones(milestones) {
    return milestones?.filter(m => m.status === 'blocked') || [];
  },

  getMonthlyCost(facility) {
    const serviceFee = facility.monthly_service_fee || 0;
    const lisFee = facility.monthly_lis_saas_fee || 0;
    return serviceFee + lisFee;
  },

  getConfigurationLabel(config) {
    const labels = {
      'waived': 'Waived Complexity',
      'moderate': 'Moderate Complexity',
    };
    return labels[config] || config;
  },

  getStatusBadgeColor(status) {
    const colors = {
      'not_started': 'bg-slate-700',
      'in_progress': 'bg-blue-600',
      'live': 'bg-green-600',
      'blocked': 'bg-red-600',
    };
    return colors[status] || 'bg-slate-600';
  },

  getStatusTextColor(status) {
    const colors = {
      'not_started': 'text-slate-300',
      'in_progress': 'text-white',
      'live': 'text-white',
      'blocked': 'text-white',
    };
    return colors[status] || 'text-slate-300';
  },
};
