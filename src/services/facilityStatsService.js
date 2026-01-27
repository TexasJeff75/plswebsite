export const facilityStatsService = {
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
