import React, { useState, useEffect } from 'react';
import { referenceDataService, CATEGORY_GROUPS, CATEGORY_LABELS } from '../services/referenceDataService';
import { invalidateReferenceCache } from '../hooks/useReferenceData';
import {
  Plus, Edit2, Trash2, X, Check, Loader2, Lock, ToggleLeft, ToggleRight,
  GripVertical, AlertTriangle, RefreshCw
} from 'lucide-react';

export default function ReferenceData() {
  const [selectedCategory, setSelectedCategory] = useState('configuration_type');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migrateFrom, setMigrateFrom] = useState(null);
  const [migrateTo, setMigrateTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    display_name: '',
    description: '',
    color: '',
    sort_order: 0,
    is_active: true
  });

  useEffect(() => {
    loadItems();
  }, [selectedCategory]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await referenceDataService.getByCategory(selectedCategory, true);
      setItems(data);
    } catch (error) {
      console.error('Error loading reference data:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setFormData({
      code: '',
      display_name: '',
      description: '',
      color: '',
      sort_order: items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0,
      is_active: true
    });
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormData({
      code: item.code,
      display_name: item.display_name,
      description: item.description || '',
      color: item.color || '',
      sort_order: item.sort_order,
      is_active: item.is_active
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.display_name.trim()) return;

    setSaving(true);
    try {
      if (editingItem) {
        await referenceDataService.update(editingItem.id, formData);
      } else {
        await referenceDataService.create({
          ...formData,
          category: selectedCategory,
          code: formData.code || formData.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        });
      }
      invalidateReferenceCache(selectedCategory);
      setShowModal(false);
      loadItems();
    } catch (error) {
      console.error('Error saving:', error);
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item) {
    try {
      if (item.is_active) {
        const usage = await referenceDataService.checkUsage(selectedCategory, item.code);
        if (usage.total > 0) {
          setUsageData({ item, usage });
          setShowUsageModal(true);
          return;
        }
        await referenceDataService.deactivate(item.id);
      } else {
        await referenceDataService.reactivate(item.id);
      }
      invalidateReferenceCache(selectedCategory);
      loadItems();
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  }

  async function confirmDeactivate() {
    try {
      await referenceDataService.deactivate(usageData.item.id);
      invalidateReferenceCache(selectedCategory);
      setShowUsageModal(false);
      setUsageData(null);
      loadItems();
    } catch (error) {
      console.error('Error deactivating:', error);
    }
  }

  async function handleDelete(item) {
    if (item.is_system) {
      alert('Cannot delete system reference data');
      return;
    }

    const usage = await referenceDataService.checkUsage(selectedCategory, item.code);
    if (usage.total > 0) {
      alert(`Cannot delete - this value is used in ${usage.total} records. Deactivate instead.`);
      return;
    }

    if (!confirm(`Delete "${item.display_name}"? This cannot be undone.`)) return;

    try {
      await referenceDataService.delete(item.id);
      invalidateReferenceCache(selectedCategory);
      loadItems();
    } catch (error) {
      console.error('Error deleting:', error);
      alert(error.message);
    }
  }

  function openMigrateModal(item) {
    setMigrateFrom(item);
    setMigrateTo('');
    setShowMigrateModal(true);
  }

  async function handleMigrate() {
    if (!migrateTo) return;

    setSaving(true);
    try {
      const result = await referenceDataService.migrateRecords(selectedCategory, migrateFrom.code, migrateTo);
      alert(`Migrated ${result.migrated} records successfully`);
      setShowMigrateModal(false);
      setMigrateFrom(null);
      loadItems();
    } catch (error) {
      console.error('Error migrating:', error);
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  const activeItems = items.filter(i => i.is_active);

  return (
    <>
      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
              <div key={group}>
                <div className="px-4 py-2 bg-slate-700/30 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {group}
                </div>
                {categories.map(cat => {
                  const count = items.filter(i => i.category === cat && i.is_active).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                        selectedCategory === cat
                          ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-400'
                          : 'text-slate-300 hover:bg-slate-700/30 border-l-2 border-transparent'
                      }`}
                    >
                      <span>{CATEGORY_LABELS[cat] || cat}</span>
                      {selectedCategory === cat && (
                        <span className="text-xs text-slate-400">{items.filter(i => i.is_active).length}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                </h2>
                <p className="text-slate-400 text-sm">
                  {activeItems.length} active value{activeItems.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Value
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400">
                No values in this category yet.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider w-8"></th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Display Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Color</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-700/20 ${!item.is_active ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <GripVertical className="w-4 h-4 text-slate-600 cursor-move" />
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-slate-400 text-xs bg-slate-900 px-2 py-1 rounded">
                          {item.code}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.is_system && <Lock className="w-3 h-3 text-slate-500" />}
                          <span className={`text-white ${!item.is_active ? 'line-through' : ''}`}>
                            {item.display_name}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-slate-500 text-xs mt-0.5 truncate max-w-xs">{item.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.color ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded border border-slate-600"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-slate-400 text-xs">{item.color}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(item)}
                          className={`flex items-center gap-1.5 text-xs ${
                            item.is_active ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {item.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!item.is_active && (
                            <button
                              onClick={() => openMigrateModal(item)}
                              className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Migrate Records"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          {!item.is_system && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Value' : 'Add Value'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!editingItem && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 font-mono text-sm"
                    placeholder="auto_generated_from_name"
                  />
                  <p className="text-slate-500 text-xs mt-1">Unique identifier (lowercase, underscores)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Display Name"
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || '#6b7280'}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-10 h-10 bg-slate-900 border border-slate-700 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                      placeholder="#6b7280"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    min="0"
                  />
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
                disabled={!formData.display_name.trim() || saving}
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
                    {editingItem ? 'Save Changes' : 'Add Value'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUsageModal && usageData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Value In Use</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                "<span className="font-medium text-white">{usageData.item.display_name}</span>" is currently used in:
              </p>
              <ul className="space-y-1 text-sm text-slate-400">
                {usageData.usage.details.map((detail, i) => (
                  <li key={i}>{detail.count} record(s) in {detail.table}</li>
                ))}
              </ul>
              <div className="bg-slate-900 rounded-lg p-4 text-sm text-slate-400">
                <p className="font-medium text-slate-300 mb-2">Deactivating will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Hide this option from dropdown menus</li>
                  <li>Existing records will retain this value</li>
                  <li>Reporting will still include historical data</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => { setShowUsageModal(false); setUsageData(null); }}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-lg transition-colors"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {showMigrateModal && migrateFrom && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Migrate Records</h2>
              <button
                onClick={() => { setShowMigrateModal(false); setMigrateFrom(null); }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-slate-300">
                Migrate all records from "<span className="font-medium text-white">{migrateFrom.display_name}</span>" to:
              </p>
              <select
                value={migrateTo}
                onChange={(e) => setMigrateTo(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Select target value...</option>
                {items.filter(i => i.is_active && i.id !== migrateFrom.id).map(item => (
                  <option key={item.id} value={item.code}>{item.display_name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => { setShowMigrateModal(false); setMigrateFrom(null); }}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                disabled={!migrateTo || saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Migrate Records
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
