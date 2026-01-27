import React, { useState } from 'react';
import { Calendar, AlertTriangle, Activity, Edit2, Save, X } from 'lucide-react';
import { facilityStatsService } from '../../services/facilityStatsService';
import { facilitiesService } from '../../services/facilitiesService';

export default function OverviewTab({ facility, isEditor }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);

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

  const formatDateForInput = (date) => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  };

  const startEditing = () => {
    setEditedData({
      site_configuration: facility.site_configuration || '',
      deployment_phase: facility.deployment_phase || '',
      projected_deployment_date: facility.projected_deployment_date || null,
      actual_deployment_date: facility.actual_deployment_date || null,
      projected_go_live_date: facility.projected_go_live_date || null,
      actual_go_live_date: facility.actual_go_live_date || null,
      service_fee_start_date: facility.service_fee_start_date || null,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedData({});
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      await facilitiesService.update(facility.id, editedData);
      window.location.reload();
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {isEditor && (
        <div className="flex justify-end gap-2">
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Edit Overview
            </button>
          ) : (
            <>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Configuration</p>
          {isEditing ? (
            <select
              value={editedData.site_configuration}
              onChange={(e) => setEditedData({ ...editedData, site_configuration: e.target.value })}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
              <option value="custom">Custom</option>
            </select>
          ) : (
            <p className="text-white font-semibold">{facilityStatsService.getConfigurationLabel(facility.site_configuration)}</p>
          )}
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Monthly Fee</p>
          <p className="text-white font-semibold">${facilityStatsService.getMonthlyCost(facility)}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <p className="text-slate-400 text-sm mb-2">Deployment Phase</p>
          {isEditing ? (
            <select
              value={editedData.deployment_phase}
              onChange={(e) => setEditedData({ ...editedData, deployment_phase: e.target.value })}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="planning">Planning</option>
              <option value="deployment">Deployment</option>
              <option value="testing">Testing</option>
              <option value="go_live">Go Live</option>
              <option value="operational">Operational</option>
            </select>
          ) : (
            <p className="text-white font-semibold">{facility.deployment_phase?.toUpperCase()}</p>
          )}
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
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Projected Deployment</p>
              {isEditing ? (
                <input
                  type="date"
                  value={formatDateForInput(editedData.projected_deployment_date)}
                  onChange={(e) => setEditedData({ ...editedData, projected_deployment_date: e.target.value || null })}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              ) : (
                <p className="text-white font-semibold">{formatDate(facility.projected_deployment_date)}</p>
              )}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Actual Deployment</p>
              {isEditing ? (
                <input
                  type="date"
                  value={formatDateForInput(editedData.actual_deployment_date)}
                  onChange={(e) => setEditedData({ ...editedData, actual_deployment_date: e.target.value || null })}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              ) : (
                <p className="text-white font-semibold">{formatDate(facility.actual_deployment_date)}</p>
              )}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Projected Go-Live</p>
              {isEditing ? (
                <input
                  type="date"
                  value={formatDateForInput(editedData.projected_go_live_date)}
                  onChange={(e) => setEditedData({ ...editedData, projected_go_live_date: e.target.value || null })}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              ) : (
                <p className="text-white font-semibold">{formatDate(facility.projected_go_live_date)}</p>
              )}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Actual Go-Live</p>
              {isEditing ? (
                <input
                  type="date"
                  value={formatDateForInput(editedData.actual_go_live_date)}
                  onChange={(e) => setEditedData({ ...editedData, actual_go_live_date: e.target.value || null })}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              ) : (
                <p className="text-white font-semibold">{formatDate(facility.actual_go_live_date)}</p>
              )}
            </div>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-3">
            <Calendar className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-slate-400 text-xs mb-1">Service Fee Start</p>
              {isEditing ? (
                <input
                  type="date"
                  value={formatDateForInput(editedData.service_fee_start_date)}
                  onChange={(e) => setEditedData({ ...editedData, service_fee_start_date: e.target.value || null })}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              ) : (
                <p className="text-white font-semibold">{formatDate(facility.service_fee_start_date)}</p>
              )}
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
