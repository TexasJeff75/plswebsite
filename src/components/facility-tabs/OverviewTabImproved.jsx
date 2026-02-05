import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, Activity, Edit2, Check, Clock, X } from 'lucide-react';
import { facilityStatsService } from '../../services/facilityStatsService';
import { facilitiesService } from '../../services/facilitiesService';

export default function OverviewTabImproved({ facility, isEditor, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [error, setError] = useState(null);
  const [saveTimeout, setSaveTimeout] = useState(null);

  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

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
    setEditedData({
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
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
  };

  const handleFieldChange = (field, value) => {
    const newData = { ...editedData, [field]: value };
    setEditedData(newData);

    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    const timeout = setTimeout(() => {
      autoSaveChanges(newData);
    }, 1500);

    setSaveTimeout(timeout);
  };

  const autoSaveChanges = async (dataToSave) => {
    try {
      setAutoSaving(true);
      setError(null);
      await facilitiesService.update(facility.id, dataToSave);
      setLastSaveTime(new Date());
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error auto-saving changes:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setAutoSaving(false);
    }
  };

  const finishEditing = async () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    if (autoSaving) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsEditing(false);
  };

  const quickSetDate = (field, daysFromNow) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    handleFieldChange(field, date.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {isEditor && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {autoSaving && (
              <span className="flex items-center gap-1 text-teal-400">
                <Clock className="w-3 h-3 animate-pulse" />
                Auto-saving...
              </span>
            )}
            {lastSaveTime && !autoSaving && (
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Saved at {lastSaveTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={startEditing}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <button
                onClick={finishEditing}
                disabled={autoSaving}
                className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {isEditing && (
        <div className="bg-teal-900/20 border border-teal-700/50 rounded-lg p-3 text-teal-300 text-xs">
          💡 Changes save automatically as you type. Click "Done" when finished.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 p-3 rounded">
          <p className="text-slate-400 text-xs mb-1">Configuration</p>
          <p className="text-white font-medium text-sm">
            {facility.deployment_template?.template_name || 'No template applied'}
          </p>
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
          <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Key Dates
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 p-3 rounded space-y-2">
              <label className="text-slate-400 text-xs block">Projected Deployment</label>
              <input
                type="date"
                value={formatDateForInput(editedData.projected_deployment_date)}
                onChange={(e) => handleFieldChange('projected_deployment_date', e.target.value)}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => quickSetDate('projected_deployment_date', 7)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +1w
                </button>
                <button
                  onClick={() => quickSetDate('projected_deployment_date', 30)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +1m
                </button>
                <button
                  onClick={() => quickSetDate('projected_deployment_date', 90)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +3m
                </button>
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded space-y-2">
              <label className="text-slate-400 text-xs block">Actual Deployment</label>
              <input
                type="date"
                value={formatDateForInput(editedData.actual_deployment_date)}
                onChange={(e) => handleFieldChange('actual_deployment_date', e.target.value)}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
              <button
                onClick={() => handleFieldChange('actual_deployment_date', new Date().toISOString().split('T')[0])}
                className="text-xs px-2 py-0.5 bg-teal-700 hover:bg-teal-600 text-white rounded"
              >
                Set to Today
              </button>
            </div>

            <div className="bg-slate-800 p-3 rounded space-y-2">
              <label className="text-slate-400 text-xs block">Projected Go-Live</label>
              <input
                type="date"
                value={formatDateForInput(editedData.projected_go_live_date)}
                onChange={(e) => handleFieldChange('projected_go_live_date', e.target.value)}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => quickSetDate('projected_go_live_date', 7)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +1w
                </button>
                <button
                  onClick={() => quickSetDate('projected_go_live_date', 30)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +1m
                </button>
                <button
                  onClick={() => quickSetDate('projected_go_live_date', 90)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +3m
                </button>
              </div>
            </div>

            <div className="bg-slate-800 p-3 rounded space-y-2">
              <label className="text-slate-400 text-xs block">Actual Go-Live</label>
              <input
                type="date"
                value={formatDateForInput(editedData.actual_go_live_date)}
                onChange={(e) => handleFieldChange('actual_go_live_date', e.target.value)}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
              <button
                onClick={() => handleFieldChange('actual_go_live_date', new Date().toISOString().split('T')[0])}
                className="text-xs px-2 py-0.5 bg-teal-700 hover:bg-teal-600 text-white rounded"
              >
                Set to Today
              </button>
            </div>

            <div className="bg-slate-800 p-3 rounded space-y-2 col-span-2">
              <label className="text-slate-400 text-xs block">Service Fee Start Date</label>
              <input
                type="date"
                value={formatDateForInput(editedData.service_fee_start_date)}
                onChange={(e) => handleFieldChange('service_fee_start_date', e.target.value)}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => handleFieldChange('service_fee_start_date', new Date().toISOString().split('T')[0])}
                  className="text-xs px-2 py-0.5 bg-teal-700 hover:bg-teal-600 text-white rounded"
                >
                  Set to Today
                </button>
                <button
                  onClick={() => quickSetDate('service_fee_start_date', 30)}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >
                  +1m
                </button>
              </div>
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
