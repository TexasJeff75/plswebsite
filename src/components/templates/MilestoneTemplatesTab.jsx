import React, { useState, useEffect } from 'react';
import { templatesService } from '../../services/templatesService';
import ReferenceSelect from '../ui/ReferenceSelect';
import ReferenceBadge, { ReferenceText } from '../ui/ReferenceBadge';
import {
  Plus, Edit2, Trash2, X, ChevronDown, Check, Loader2
} from 'lucide-react';

const APPLIES_TO = [
  { id: 'both', label: 'Both (Waived & Moderate)' },
  { id: 'waived', label: 'Waived Only' },
  { id: 'moderate', label: 'Moderate Only' },
];

export default function MilestoneTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'regulatory',
    responsible_party_default: 'Proximity',
    priority: 5,
    dependencies: [],
    phase: 'both'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await templatesService.getMilestoneTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Error loading milestone templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingTemplate(null);
    setFormData({
      title: '',
      description: '',
      category: 'regulatory',
      responsible_party_default: 'Proximity',
      priority: 5,
      dependencies: [],
      phase: 'both'
    });
    setShowModal(true);
  }

  function openEditModal(template) {
    setEditingTemplate(template);
    setFormData({
      title: template.title,
      description: template.description || '',
      category: template.category,
      responsible_party_default: template.responsible_party_default || 'Proximity',
      priority: template.priority || 5,
      dependencies: template.dependencies || [],
      phase: template.phase || 'both'
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      if (editingTemplate) {
        await templatesService.updateMilestoneTemplate(editingTemplate.id, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          responsible_party_default: formData.responsible_party_default,
          priority: formData.priority,
          dependencies: formData.dependencies,
          phase: formData.phase
        });
      } else {
        await templatesService.createMilestoneTemplate({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          responsible_party_default: formData.responsible_party_default,
          priority: formData.priority,
          dependencies: formData.dependencies,
          phase: formData.phase,
          is_system_template: true
        });
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving milestone template:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template) {
    if (!confirm(`Delete milestone template "${template.title}"?`)) return;

    try {
      await templatesService.deleteMilestoneTemplate(template.id);
      loadData();
    } catch (error) {
      console.error('Error deleting milestone template:', error);
    }
  }

  function toggleDependency(milestoneId) {
    setFormData(prev => ({
      ...prev,
      dependencies: prev.dependencies.includes(milestoneId)
        ? prev.dependencies.filter(d => d !== milestoneId)
        : [...prev.dependencies, milestoneId]
    }));
  }

  const availableDependencies = templates.filter(t => t.id !== editingTemplate?.id);

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
          <p className="text-slate-400 text-sm">{templates.length} milestone template{templates.length !== 1 ? 's' : ''}</p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Milestone Template
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Responsible Party</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Applies To</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-slate-400">
                    No milestone templates yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{template.title}</p>
                      {template.description && (
                        <p className="text-slate-400 text-sm truncate max-w-xs">{template.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReferenceBadge category="milestone_category" code={template.category} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <ReferenceText category="responsible_party" code={template.responsible_party_default?.toLowerCase()} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-slate-700 text-slate-300">
                        {APPLIES_TO.find(a => a.id === template.phase)?.label || 'Both'}
                      </span>
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
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingTemplate ? 'Edit Milestone Template' : 'Create Milestone Template'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Milestone name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                  <ReferenceSelect
                    category="milestone_category"
                    value={formData.category}
                    onChange={(value) => setFormData({ ...formData, category: value || 'regulatory' })}
                    showColors
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Responsible Party</label>
                  <ReferenceSelect
                    category="responsible_party"
                    value={formData.responsible_party_default?.toLowerCase()}
                    onChange={(value) => setFormData({ ...formData, responsible_party_default: value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Priority <span className="text-slate-500 text-xs">(lower = higher priority)</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
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

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Applies To</label>
                <div className="relative">
                  <select
                    value={formData.phase}
                    onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                    className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                  >
                    {APPLIES_TO.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {availableDependencies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Dependencies ({formData.dependencies.length} selected)
                  </label>
                  <div className="bg-slate-900 border border-slate-700 rounded-lg max-h-40 overflow-y-auto">
                    <div className="divide-y divide-slate-700/50">
                      {availableDependencies.map(dep => (
                        <label
                          key={dep.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.dependencies.includes(dep.id)}
                            onChange={() => toggleDependency(dep.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm">{dep.title}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
                disabled={!formData.title.trim() || saving}
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

