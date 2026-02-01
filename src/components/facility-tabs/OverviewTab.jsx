import React, { useState } from 'react';
import { Calendar, AlertTriangle, Activity, Edit2, Save, X, CheckCircle2 } from 'lucide-react';
import FormError from '../FormError';
import { facilityStatsService } from '../../services/facilityStatsService';
import { facilitiesService } from '../../services/facilitiesService';
import { validateForm, validators } from '../../utils/formValidation';

export default function OverviewTab({ facility, isEditor, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
    setError(null);
    setValidationErrors({});
    setSuccess(null);
    setEditedData({
      site_configuration: facility.site_configuration || '',
      deployment_phase: facility.deployment_phase || '',
      projected_deployment_date: facility.projected_deployment_date || '',
      actual_deployment_date: facility.actual_deployment_date || '',
      projected_go_live_date: facility.projected_go_live_date || '',
      actual_go_live_date: facility.actual_go_live_date || '',
      service_fee_start_date: facility.service_fee_start_date || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedData({});
    setError(null);
    setValidationErrors({});
  };

  const saveChanges = async () => {
    const rules = {
      site_configuration: (val) => validators.required(val, 'Configuration'),
      deployment_phase: (val) => validators.required(val, 'Deployment phase'),
      projected_deployment_date: (val) => {
        if (val && editedData.actual_deployment_date) {
          return validators.dateRange(val, editedData.actual_deployment_date, {
            start: 'Projected deployment',
            end: 'Actual deployment'
          });
        }
        return null;
      },
      projected_go_live_date: (val) => {
        if (val && editedData.actual_go_live_date) {
          return validators.dateRange(val, editedData.actual_go_live_date, {
            start: 'Projected go-live',
            end: 'Actual go-live'
          });
        }
        return null;
      }
    };

    const { isValid, errors } = validateForm(editedData, rules);

    if (!isValid) {
      setValidationErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setValidationErrors({});

      const updatedFacility = await facilitiesService.update(facility.id, editedData);
      setIsEditing(false);
      setSuccess('Configuration updated successfully');
      setTimeout(() => setSuccess(null), 3000);

      if (onUpdate) {
        onUpdate(updatedFacility);
      }
    } catch (err) {
      console.error('Error saving changes:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {isEditor && (
        <div className="flex justify-end gap-2">
          {!isEditing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}

      <FormError message={error} onDismiss={() => setError(null)} />

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3 mb-4">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-200">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Configuration</p>
          {isEditing ? (
            <select
              value={editedData.site_configuration}
              onChange={(e) => setEditedData({ ...editedData, site_configuration: e.target.value })}
              className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
            >
              <option value="">Select</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
              <option value="custom">Custom</option>
            </select>
          ) : (
            <p className="text-white font-medium text-sm">{facilityStatsService.getConfigurationLabel(facility.site_configuration)}</p>
          )}
        </div>
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Monthly Fee</p>
          <p className="text-white font-medium text-sm">${facilityStatsService.getMonthlyCost(facility)}</p>
        </div>
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Phase</p>
          {isEditing ? (
            <select
              value={editedData.deployment_phase}
              onChange={(e) => setEditedData({ ...editedData, deployment_phase: e.target.value })}
              className="w-full bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
            >
              <option value="">Select</option>
              <option value="planning">Planning</option>
              <option value="deployment">Deployment</option>
              <option value="testing">Testing</option>
              <option value="go_live">Go Live</option>
              <option value="operational">Operational</option>
            </select>
          ) : (
            <p className="text-white font-medium text-sm uppercase">{facility.deployment_phase}</p>
          )}
        </div>
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Status</p>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColor} ${statusTextColor}`}>
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>

      {isEditing && (
        <div>
          <h3 className="text-white font-semibold mb-3 text-sm">Key Dates</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800 p-2 rounded">
              <label className="text-slate-400 text-xs block mb-1">Proj. Deployment</label>
              <input
                type="date"
                value={formatDateForInput(editedData.projected_deployment_date)}
                onChange={(e) => setEditedData({ ...editedData, projected_deployment_date: e.target.value })}
                className="w-full bg-slate-700 text-white px-1.5 py-0.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>
            <div className="bg-slate-800 p-2 rounded">
              <label className="text-slate-400 text-xs block mb-1">Act. Deployment</label>
              <input
                type="date"
                value={formatDateForInput(editedData.actual_deployment_date)}
                onChange={(e) => setEditedData({ ...editedData, actual_deployment_date: e.target.value })}
                className="w-full bg-slate-700 text-white px-1.5 py-0.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>
            <div className="bg-slate-800 p-2 rounded">
              <label className="text-slate-400 text-xs block mb-1">Proj. Go-Live</label>
              <input
                type="date"
                value={formatDateForInput(editedData.projected_go_live_date)}
                onChange={(e) => setEditedData({ ...editedData, projected_go_live_date: e.target.value })}
                className="w-full bg-slate-700 text-white px-1.5 py-0.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>
            <div className="bg-slate-800 p-2 rounded">
              <label className="text-slate-400 text-xs block mb-1">Act. Go-Live</label>
              <input
                type="date"
                value={formatDateForInput(editedData.actual_go_live_date)}
                onChange={(e) => setEditedData({ ...editedData, actual_go_live_date: e.target.value })}
                className="w-full bg-slate-700 text-white px-1.5 py-0.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>
            <div className="bg-slate-800 p-2 rounded col-span-2">
              <label className="text-slate-400 text-xs block mb-1">Service Fee Start</label>
              <input
                type="date"
                value={formatDateForInput(editedData.service_fee_start_date)}
                onChange={(e) => setEditedData({ ...editedData, service_fee_start_date: e.target.value })}
                className="w-full bg-slate-700 text-white px-1.5 py-0.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
            </div>
          </div>
        </div>
      )}

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
