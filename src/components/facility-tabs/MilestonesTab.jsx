import React, { useState, useEffect } from 'react';
import { Flag, AlertTriangle, Plus, CheckCircle2, Clock, XCircle, Minus, Loader2, Pencil, Trash2, X, Check } from 'lucide-react';
import { facilityStatsService } from '../../services/facilityStatsService';
import { facilitiesService } from '../../services/facilitiesService';

const MILESTONE_CATEGORIES = ['regulatory', 'equipment', 'integration', 'training', 'go_live', 'uncategorized'];
const CATEGORY_LABELS = {
  regulatory: 'Regulatory',
  equipment: 'Equipment',
  integration: 'Integration',
  training: 'Training',
  go_live: 'Go-Live',
  uncategorized: 'Other Milestones',
};

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', icon: Clock, color: 'bg-slate-600 text-slate-200' },
  { value: 'in_progress', label: 'In Progress', icon: Loader2, color: 'bg-blue-600 text-white' },
  { value: 'complete', label: 'Complete', icon: CheckCircle2, color: 'bg-green-600 text-white' },
  { value: 'blocked', label: 'Blocked', icon: XCircle, color: 'bg-red-600 text-white' },
  { value: 'not_applicable', label: 'N/A', icon: Minus, color: 'bg-gray-600 text-gray-200' },
];

const STATUS_COLORS = {
  'not_started': 'bg-slate-700 text-slate-300',
  'in_progress': 'bg-blue-700 text-white',
  'complete': 'bg-green-700 text-white',
  'blocked': 'bg-red-700 text-white',
  'not_applicable': 'bg-gray-700 text-gray-300',
};

export default function MilestonesTab({ facility, isEditor, onUpdate }) {
  const [milestones, setMilestones] = useState([]);
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    name: '',
    description: '',
    category: 'regulatory',
    status: 'not_started',
    responsible_party: '',
    target_date: '',
    sla_hours: '',
  });

  useEffect(() => {
    if (facility?.milestones) {
      setMilestones(facility.milestones);
    }
  }, [facility?.milestones]);

  async function handleAddMilestone() {
    if (!newMilestone.name.trim()) return;

    setSaving(true);
    try {
      const milestone = await facilitiesService.createMilestone({
        facility_id: facility.id,
        name: newMilestone.name,
        description: newMilestone.description || null,
        category: newMilestone.category,
        status: newMilestone.status,
        responsible_party: newMilestone.responsible_party || null,
        target_date: newMilestone.target_date || null,
        sla_hours: newMilestone.sla_hours ? parseInt(newMilestone.sla_hours) : null,
        milestone_order: milestones.length + 1,
      });
      setMilestones([...milestones, milestone]);
      setNewMilestone({
        name: '',
        description: '',
        category: 'regulatory',
        status: 'not_started',
        responsible_party: '',
        target_date: '',
        sla_hours: '',
      });
      setShowAddForm(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding milestone:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(milestoneId, newStatus) {
    try {
      const updates = { status: newStatus };
      if (newStatus === 'complete') {
        updates.completion_date = new Date().toISOString().split('T')[0];
      }
      if (newStatus === 'in_progress' && !milestones.find(m => m.id === milestoneId)?.start_date) {
        updates.start_date = new Date().toISOString().split('T')[0];
      }

      const updated = await facilitiesService.updateMilestone(milestoneId, updates);
      setMilestones(milestones.map(m => m.id === milestoneId ? { ...m, ...updated } : m));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  }

  async function handleSaveEdit() {
    if (!editingMilestone) return;

    setSaving(true);
    try {
      const updated = await facilitiesService.updateMilestone(editingMilestone.id, {
        name: editingMilestone.name,
        description: editingMilestone.description,
        category: editingMilestone.category,
        responsible_party: editingMilestone.responsible_party,
        target_date: editingMilestone.target_date || null,
        sla_hours: editingMilestone.sla_hours ? parseInt(editingMilestone.sla_hours) : null,
        blocked_reason: editingMilestone.blocked_reason,
      });
      setMilestones(milestones.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      setEditingMilestone(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating milestone:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMilestone(milestoneId) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;

    try {
      const { error } = await facilitiesService.updateMilestone(milestoneId, { deleted_at: new Date().toISOString() });
      setMilestones(milestones.filter(m => m.id !== milestoneId));
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting milestone:', error);
    }
  }

  const baseMilestonesByCategory = facilityStatsService.getMilestonesByCategory(milestones);
  const uncategorizedMilestones = milestones.filter(m =>
    !m.category || !['regulatory', 'equipment', 'integration', 'training', 'go_live'].includes(m.category)
  );
  const milestonesByCategory = {
    ...baseMilestonesByCategory,
    uncategorized: uncategorizedMilestones,
  };
  const hasAnyMilestones = milestones && milestones.length > 0;

  if (!hasAnyMilestones && !showAddForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-semibold text-white">Milestone Tracking</h3>
          </div>
          {isEditor && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Flag className="w-8 h-8 text-slate-500" />
          </div>
          <h4 className="text-white font-semibold text-lg mb-2">No Milestones Yet</h4>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Milestones help track the progress of this facility's deployment. You can add milestones manually or apply a deployment template from the facility header.
          </p>
          {isEditor && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add First Milestone
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-white">Milestone Tracking</h3>
        </div>
        {isEditor && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        )}
      </div>

      {showAddForm && isEditor && (
        <div className="bg-slate-800 border border-teal-600/50 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-semibold">New Milestone</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-xs mb-1">Milestone Name *</label>
              <input
                type="text"
                value={newMilestone.name}
                onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                placeholder="e.g., CLIA Certificate Obtained"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-xs mb-1">Description</label>
              <textarea
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                placeholder="Optional details about this milestone"
                rows={2}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Category</label>
              <select
                value={newMilestone.category}
                onChange={(e) => setNewMilestone({ ...newMilestone, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {MILESTONE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Status</label>
              <select
                value={newMilestone.status}
                onChange={(e) => setNewMilestone({ ...newMilestone, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Responsible Party</label>
              <input
                type="text"
                value={newMilestone.responsible_party}
                onChange={(e) => setNewMilestone({ ...newMilestone, responsible_party: e.target.value })}
                placeholder="e.g., Proximity, Facility"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">Target Date</label>
              <input
                type="date"
                value={newMilestone.target_date}
                onChange={(e) => setNewMilestone({ ...newMilestone, target_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">SLA (hours)</label>
              <input
                type="number"
                value={newMilestone.sla_hours}
                onChange={(e) => setNewMilestone({ ...newMilestone, sla_hours: e.target.value })}
                placeholder="e.g., 48"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMilestone}
              disabled={!newMilestone.name.trim() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Milestone
            </button>
          </div>
        </div>
      )}

      {MILESTONE_CATEGORIES.map(category => {
        const categoryMilestones = milestonesByCategory[category] || [];
        const progress = category === 'uncategorized'
          ? (categoryMilestones.length > 0 ? Math.round((categoryMilestones.filter(m => m.status === 'complete').length / categoryMilestones.length) * 100) : 0)
          : facilityStatsService.getCategoryProgress(milestones, category);

        if (categoryMilestones.length === 0) return null;

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
              {categoryMilestones.map(milestone => (
                <div
                  key={milestone.id}
                  className="bg-slate-700 rounded p-4"
                >
                  {editingMilestone?.id === milestone.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-slate-400 text-xs mb-1">Name</label>
                        <input
                          type="text"
                          value={editingMilestone.name}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 text-xs mb-1">Description</label>
                        <textarea
                          value={editingMilestone.description || ''}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Responsible Party</label>
                          <input
                            type="text"
                            value={editingMilestone.responsible_party || ''}
                            onChange={(e) => setEditingMilestone({ ...editingMilestone, responsible_party: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Target Date</label>
                          <input
                            type="date"
                            value={editingMilestone.target_date || ''}
                            onChange={(e) => setEditingMilestone({ ...editingMilestone, target_date: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                          />
                        </div>
                      </div>
                      {milestone.status === 'blocked' && (
                        <div>
                          <label className="block text-slate-400 text-xs mb-1">Blocked Reason</label>
                          <input
                            type="text"
                            value={editingMilestone.blocked_reason || ''}
                            onChange={(e) => setEditingMilestone({ ...editingMilestone, blocked_reason: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingMilestone(null)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded text-sm transition-colors"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="cursor-pointer"
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
                      </div>

                      {expandedMilestone === milestone.id && (
                        <div className="mt-4 pt-4 border-t border-slate-600 space-y-3">
                          {isEditor && (
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                              <span className="text-slate-400 text-xs">Update Status:</span>
                              {STATUS_OPTIONS.map(opt => {
                                const Icon = opt.icon;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => handleUpdateStatus(milestone.id, opt.value)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                      milestone.status === opt.value
                                        ? opt.color
                                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                    }`}
                                  >
                                    <Icon className="w-3 h-3" />
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}

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
                                  const depMilestone = milestones.find(m => m.id === depId);
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

                          {isEditor && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-600">
                              <button
                                onClick={() => setEditingMilestone({ ...milestone })}
                                className="flex items-center gap-1 px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded text-xs transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMilestone(milestone.id)}
                                className="flex items-center gap-1 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded text-xs transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
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
