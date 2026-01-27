import React from 'react';
import { Calendar, AlertTriangle, Activity } from 'lucide-react';
import { facilityStatsService } from '../../services/facilityStatsService';

export default function OverviewTab({ facility }) {
  if (!facility) return null;

  const blockedMilestones = facilityStatsService.getBlockedMilestones(facility.milestones);
  const overallStatus = facilityStatsService.calculateOverallStatus(facility);
  const statusColor = facilityStatsService.getStatusBadgeColor(overallStatus);
  const statusTextColor = facilityStatsService.getStatusTextColor(overallStatus);

  const completionPercentage = facilityStatsService.calculateCompletionPercentage(facility.milestones);
  const categoryProgress = {
    regulatory: facilityStatsService.getCategoryProgress(facility.milestones, 'regulatory'),
    equipment: facilityStatsService.getCategoryProgress(facility.milestones, 'equipment'),
    integration: facilityStatsService.getCategoryProgress(facility.milestones, 'integration'),
    training: facilityStatsService.getCategoryProgress(facility.milestones, 'training'),
    goLive: facilityStatsService.getCategoryProgress(facility.milestones, 'go_live'),
  };

  const formatDate = (date) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Configuration</p>
          <p className="text-white font-semibold">{facilityStatsService.getConfigurationLabel(facility.site_configuration)}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Monthly Fee</p>
          <p className="text-white font-semibold">${facilityStatsService.getMonthlyCost(facility)}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Deployment Phase</p>
          <p className="text-white font-semibold">{facility.deployment_phase?.toUpperCase()}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Overall Status</p>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColor} ${statusTextColor}`}>
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold mb-4">Key Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Projected Deployment</p>
              <p className="text-white font-semibold">{formatDate(facility.projected_deployment_date)}</p>
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Actual Deployment</p>
              <p className="text-white font-semibold">{formatDate(facility.actual_deployment_date)}</p>
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Projected Go-Live</p>
              <p className="text-white font-semibold">{formatDate(facility.projected_go_live_date)}</p>
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Actual Go-Live</p>
              <p className="text-white font-semibold">{formatDate(facility.actual_go_live_date)}</p>
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">Service Fee Start</p>
              <p className="text-white font-semibold">{formatDate(facility.service_fee_start_date)}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-white font-semibold mb-4">Overall Progress: {completionPercentage}%</h3>
        <div className="space-y-3">
          {[
            { label: 'Regulatory', value: categoryProgress.regulatory },
            { label: 'Equipment', value: categoryProgress.equipment },
            { label: 'Integration', value: categoryProgress.integration },
            { label: 'Training', value: categoryProgress.training },
            { label: 'Go-Live', value: categoryProgress.goLive },
          ].map(cat => (
            <div key={cat.label}>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 text-sm">{cat.label}</span>
                <span className="text-slate-400 text-xs">{cat.value}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cat.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {blockedMilestones.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-200 font-semibold mb-2">Blocked Items</h4>
              <ul className="space-y-1">
                {blockedMilestones.map(m => (
                  <li key={m.id} className="text-red-300 text-sm">
                    {m.name} {m.blocked_since && `(blocked since ${new Date(m.blocked_since).toLocaleDateString()})`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {facility.activity_log && facility.activity_log.length > 0 && (
        <div>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {facility.activity_log.slice(0, 5).map(entry => (
              <div key={entry.id} className="bg-slate-800 p-3 rounded text-sm">
                <p className="text-slate-300">
                  <span className="text-teal-300">{entry.user || 'Unknown'}</span> {entry.action} {entry.field_name}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {new Date(entry.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
