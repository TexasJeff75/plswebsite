import React, { useState, useEffect } from 'react';
import { templatesService } from '../../services/templatesService';
import { format } from 'date-fns';
import {
  Plus, Edit2, Trash2, Copy, X, ChevronDown, Check, Loader2, RefreshCw
} from 'lucide-react';

const TEMPLATE_TYPES = [
  { id: 'mini_lab_waived', label: 'Mini Lab - Waived' },
  { id: 'mini_lab_moderate', label: 'Mini Lab - Moderate' },
  { id: 'hosted_lab', label: 'Hosted Lab' },
  { id: 'custom', label: 'Custom' },
];

export default function DeploymentTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [milestoneTemplates, setMilestoneTemplates] = useState([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    template_name: '',
    template_type: 'mini_lab_waived',
    description: '',
    selectedMilestones: [],
    milestonePriorities: {},
    selectedEquipment: []
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [templatesData, milestonesData, equipmentData] = await Promise.all([
        templatesService.getDeploymentTemplates(),
        templatesService.getMilestoneTemplates(),
        templatesService.getEquipmentCatalog()
      ]);
      setTemplates(templatesData);
      setMilestoneTemplates(milestonesData);
      setEquipmentCatalog(equipmentData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormData({
      template_name: '',
      template_type: 'mini_lab_waived',
      description: '',
      selectedMilestones: [],
      milestonePriorities: {},
      selectedEquipment: []
    });
    setShowModal(true);
  }

  function openEditModal(template) {
    setEditingTemplate(template);
    const priorities = {};
    template.template_milestones?.forEach(tm => {
      if (tm.milestone_template?.id) {
        priorities[tm.milestone_template.id] = tm.priority || 5;
      }
    });
    setFormData({
      template_name: template.template_name,
      template_type: template.template_type,
      description: template.description || '',
      selectedMilestones: template.template_milestones?.map(tm => tm.milestone_template?.id).filter(Boolean) || [],
      milestonePriorities: priorities,
      selectedEquipment: template.template_equipment?.map(te => te.equipment?.id).filter(Boolean) || []
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.template_name.trim()) return;

    setSaving(true);
    try {
      let templateId;

      if (editingTemplate) {
        await templatesService.updateDeploymentTemplate(editingTemplate.id, {
          template_name: formData.template_name,
          template_type: formData.template_type,
          description: formData.description
        });
        templateId = editingTemplate.id;
      } else {
        const newTemplate = await templatesService.createDeploymentTemplate({
          template_name: formData.template_name,
          template_type: formData.template_type,
          description: formData.description,
          is_system_template: true
        });
        templateId = newTemplate.id;
      }

      await templatesService.setTemplateMilestones(templateId, formData.selectedMilestones, formData.milestonePriorities);
      await templatesService.setTemplateEquipment(templateId, formData.selectedEquipment);

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template) {
    if (!confirm(`Delete template "${template.template_name}"?`)) return;

    try {
      await templatesService.deleteDeploymentTemplate(template.id);
      loadData();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  async function handleDuplicate(template) {
    try {
      await templatesService.duplicateDeploymentTemplate(template.id);
      loadData();
    } catch (error) {
      console.error('Error duplicating template:', error);
    }
  }

  async function handleSyncToFacilities(template) {
    if (!confirm(`Push equipment updates from "${template.template_name}" to all facilities using this template?\n\nThis will add new equipment items but won't remove existing ones.`)) return;

    try {
      setSaving(true);
      const results = await templatesService.syncTemplateToFacilities(template.id);
      const totalAdded = results.reduce((sum, r) => sum + r.equipment_added, 0);
      alert(`Successfully synced template to ${results.length} facilities.\n${totalAdded} equipment items added.`);
    } catch (error) {
      console.error('Error syncing template:', error);
      alert('Failed to sync template to facilities');
    } finally {
      setSaving(false);
    }
  }

  function toggleMilestone(id) {
    setFormData(prev => {
      const isSelected = prev.selectedMilestones.includes(id);
      const newMilestones = isSelected
        ? prev.selectedMilestones.filter(m => m !== id)
        : [...prev.selectedMilestones, id];

      const newPriorities = { ...prev.milestonePriorities };
      if (!isSelected) {
        newPriorities[id] = 5;
      } else {
        delete newPriorities[id];
      }

      return {
        ...prev,
        selectedMilestones: newMilestones,
        milestonePriorities: newPriorities
      };
    });
  }

  function updateMilestonePriority(id, priority) {
    setFormData(prev => ({
      ...prev,
      milestonePriorities: {
        ...prev.milestonePriorities,
        [id]: parseInt(priority)
      }
    }));
  }

  function toggleEquipment(id) {
    setFormData(prev => ({
      ...prev,
      selectedEquipment: prev.selectedEquipment.includes(id)
        ? prev.selectedEquipment.filter(e => e !== id)
        : [...prev.selectedEquipment, id]
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Template
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Configuration Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Milestones</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                    No templates yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{template.template_name}</p>
                      {template.description && (
                        <p className="text-slate-400 text-sm truncate max-w-xs">{template.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
                        {TEMPLATE_TYPES.find(t => t.id === template.template_type)?.label || template.template_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {template.template_milestones?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {template.template_equipment?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {template.created_at ? format(new Date(template.created_at), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(template)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSyncToFacilities(template)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Push updates to facilities"
                          disabled={saving}
                        >
                          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(template)}
                          className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingTemplate ? 'Edit Template' : 'Create Deployment Template'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Template name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Configuration Type</label>
                <div className="relative">
                  <select
                    value={formData.template_type}
                    onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                    className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                  >
                    {TEMPLATE_TYPES.map(type => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Milestone Checklist ({formData.selectedMilestones.length} selected)
                </label>
                <div className="bg-slate-900 border border-slate-700 rounded-lg max-h-64 overflow-y-auto">
                  {milestoneTemplates.length === 0 ? (
                    <p className="p-4 text-slate-400 text-sm text-center">No milestone templates available</p>
                  ) : (
                    <div className="divide-y divide-slate-700/50">
                      {milestoneTemplates.map(milestone => {
                        const isSelected = formData.selectedMilestones.includes(milestone.id);
                        return (
                          <div
                            key={milestone.id}
                            className="hover:bg-slate-800"
                          >
                            <label className="flex items-center gap-3 px-4 py-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMilestone(milestone.id)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm">{milestone.title}</p>
                                <p className="text-slate-400 text-xs">{milestone.category}</p>
                              </div>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-xs">Priority:</span>
                                  <select
                                    value={formData.milestonePriorities[milestone.id] || 5}
                                    onChange={(e) => updateMilestonePriority(milestone.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-teal-500"
                                  >
                                    <option value="1">1 - Critical</option>
                                    <option value="2">2 - High</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5 - Medium</option>
                                    <option value="6">6</option>
                                    <option value="7">7</option>
                                    <option value="8">8 - Low</option>
                                    <option value="9">9</option>
                                    <option value="10">10 - Lowest</option>
                                  </select>
                                </div>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Equipment Checklist ({formData.selectedEquipment.length} selected)
                </label>
                <div className="bg-slate-900 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                  {equipmentCatalog.length === 0 ? (
                    <p className="p-4 text-slate-400 text-sm text-center">No equipment in catalog</p>
                  ) : (
                    <div className="divide-y divide-slate-700/50">
                      {equipmentCatalog.map(equipment => (
                        <label
                          key={equipment.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedEquipment.includes(equipment.id)}
                            onChange={() => toggleEquipment(equipment.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm">{equipment.equipment_name}</p>
                            <p className="text-slate-400 text-xs">{equipment.manufacturer || equipment.equipment_type}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.template_name.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
