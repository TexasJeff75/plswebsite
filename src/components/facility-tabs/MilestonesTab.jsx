import React, { useState } from 'react';
import { Flag, AlertTriangle } from 'lucide-react';
import { facilityStatsService } from '../../services/facilityStatsService';

const MILESTONE_CATEGORIES = ['regulatory', 'equipment', 'integration', 'training', 'go_live'];
const CATEGORY_LABELS = {
  regulatory: 'Regulatory',
  equipment: 'Equipment',
  integration: 'Integration',
  training: 'Training',
  go_live: 'Go-Live',
};

const STATUS_COLORS = {
  'not_started': 'bg-slate-700 text-slate-300',
  'in_progress': 'bg-blue-700 text-white',
  'complete': 'bg-green-700 text-white',
  'blocked': 'bg-red-700 text-white',
  'not_applicable': 'bg-gray-700 text-gray-300',
};

export default function MilestonesTab({ facility, isEditor }) {
  const [expandedMilestone, setExpandedMilestone] = useState(null);

  if (!facility?.milestones) {
    return <div className="text-slate-400">No milestones available</div>;
  }

  const milestonesByCategory = facilityStatsService.getMilestonesByCategory(facility.milestones);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Flag className="w-5 h-5 text-teal-400" />
        <h3 className="text-lg font-semibold text-white">Milestone Tracking</h3>
      </div>

      {MILESTONE_CATEGORIES.map(category => {
        const milestones = milestonesByCategory[category] || [];
        const progress = facilityStatsService.getCategoryProgress(facility.milestones, category);

        if (milestones.length === 0) return null;

        return (
          <div key={category} className="bg-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-white font-semibold capitalize">{CATEGORY_LABELS[category]}</h4>
              <div className="text-sm text-slate-400">{progress}% complete</div>
            </div>

            <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="space-y-2">
              {milestones.map(milestone => (
                <div
                  key={milestone.id}
                  className="bg-slate-700 rounded p-4 cursor-pointer hover:bg-slate-600 transition-colors"
                  onClick={() => setExpandedMilestone(expandedMilestone === milestone.id ? null : milestone.id)}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="text-white font-semibold">{milestone.name}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[milestone.status] || STATUS_COLORS['not_started']}`}>
                          {milestone.status?.charAt(0).toUpperCase() + milestone.status?.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                      {milestone.description && (
                        <p className="text-slate-400 text-sm mb-2">{milestone.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        {milestone.responsible_party && (
                          <span>Responsible: {milestone.responsible_party}</span>
                        )}
                        {milestone.target_date && (
                          <span>Target: {new Date(milestone.target_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {milestone.status === 'blocked' && (
                        <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
                      )}
                      {milestone.completion_date && (
                        <p className="text-teal-300 text-xs">
                          Completed: {new Date(milestone.completion_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {expandedMilestone === milestone.id && (
                    <div className="mt-4 pt-4 border-t border-slate-600 space-y-3">
                      {milestone.blocked_reason && (
                        <div className="bg-red-900/30 p-3 rounded border border-red-700">
                          <p className="text-red-200 text-sm">
                            <span className="font-semibold">Blocked Reason:</span> {milestone.blocked_reason}
                          </p>
                          {milestone.blocked_since && (
                            <p className="text-red-300 text-xs mt-1">
                              Since: {new Date(milestone.blocked_since).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}

                      {milestone.dependencies && milestone.dependencies.length > 0 && (
                        <div>
                          <p className="text-slate-300 text-sm font-semibold mb-2">Dependencies</p>
                          <div className="space-y-1">
                            {milestone.dependencies.map(depId => {
                              const depMilestone = facility.milestones.find(m => m.id === depId);
                              return (
                                <div key={depId} className="text-slate-400 text-xs bg-slate-600 p-2 rounded">
                                  {depMilestone?.name || 'Unknown milestone'}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {milestone.sla_hours && (
                        <div>
                          <p className="text-slate-300 text-sm">
                            <span className="font-semibold">SLA:</span> {milestone.sla_hours} hours
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
