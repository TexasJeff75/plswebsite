import React, { useState, useEffect } from 'react';
import { templatesService } from '../../services/templatesService';
import {
  Plus, Edit2, Trash2, X, ChevronDown, Check, Loader2
} from 'lucide-react';

const EQUIPMENT_TYPES = [
  { id: 'analyzer', label: 'Analyzer' },
  { id: 'poc_device', label: 'POC Device' },
  { id: 'laptop', label: 'Laptop' },
  { id: 'printer', label: 'Printer' },
  { id: 'barcode_scanner', label: 'Barcode Scanner' },
  { id: 'centrifuge', label: 'Centrifuge' },
  { id: 'refrigerator', label: 'Refrigerator' },
  { id: 'other', label: 'Other' },
];

const PROCUREMENT_METHODS = [
  { id: 'purchase', label: 'Purchase' },
  { id: 'reagent_rental', label: 'Reagent Rental' },
  { id: 'lease', label: 'Lease' },
  { id: 'client_provided', label: 'Client Provided' },
];

export default function EquipmentCatalogTab() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    equipment_name: '',
    equipment_type: 'analyzer',
    manufacturer: '',
    model_number: '',
    procurement_method_default: 'purchase',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await templatesService.getEquipmentCatalog();
      setEquipment(data);
    } catch (error) {
      console.error('Error loading equipment catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setFormData({
      equipment_name: '',
      equipment_type: 'analyzer',
      manufacturer: '',
      model_number: '',
      procurement_method_default: 'purchase',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormData({
      equipment_name: item.equipment_name,
      equipment_type: item.equipment_type,
      manufacturer: item.manufacturer || '',
      model_number: item.model_number || '',
      procurement_method_default: item.procurement_method_default || 'purchase',
      notes: item.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.equipment_name.trim()) return;

    setSaving(true);
    try {
      if (editingItem) {
        await templatesService.updateEquipmentCatalogItem(editingItem.id, formData);
      } else {
        await templatesService.createEquipmentCatalogItem({
          ...formData,
          is_system_item: true
        });
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving equipment:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.equipment_name}" from catalog?`)) return;

    try {
      await templatesService.deleteEquipmentCatalogItem(item.id);
      loadData();
    } catch (error) {
      console.error('Error deleting equipment:', error);
    }
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
          <p className="text-slate-400 text-sm">{equipment.length} item{equipment.length !== 1 ? 's' : ''} in catalog</p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Equipment
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Manufacturer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Model</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Default Procurement</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {equipment.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-400">
                    No equipment in catalog yet. Add some to get started.
                  </td>
                </tr>
              ) : (
                equipment.map(item => (
                  <tr key={item.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{item.equipment_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeStyle(item.equipment_type)}`}>
                        {EQUIPMENT_TYPES.find(t => t.id === item.equipment_type)?.label || item.equipment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.manufacturer || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {item.model_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {PROCUREMENT_METHODS.find(p => p.id === item.procurement_method_default)?.label || item.procurement_method_default}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
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
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Equipment' : 'Add Equipment to Catalog'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.equipment_name}
                  onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Equipment name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                  <div className="relative">
                    <select
                      value={formData.equipment_type}
                      onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                      className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                    >
                      {EQUIPMENT_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Default Procurement</label>
                  <div className="relative">
                    <select
                      value={formData.procurement_method_default}
                      onChange={(e) => setFormData({ ...formData, procurement_method_default: e.target.value })}
                      className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                    >
                      {PROCUREMENT_METHODS.map(method => (
                        <option key={method.id} value={method.id}>{method.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g. Abbott"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Model Number</label>
                  <input
                    type="text"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g. i-STAT 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                  rows={2}
                  placeholder="Optional notes"
                />
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
                disabled={!formData.equipment_name.trim() || saving}
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
                    {editingItem ? 'Save Changes' : 'Add to Catalog'}
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

function getTypeStyle(type) {
  const styles = {
    analyzer: 'bg-blue-500/10 text-blue-400',
    poc_device: 'bg-teal-500/10 text-teal-400',
    laptop: 'bg-slate-500/10 text-slate-300',
    printer: 'bg-amber-500/10 text-amber-400',
    barcode_scanner: 'bg-cyan-500/10 text-cyan-400',
    centrifuge: 'bg-emerald-500/10 text-emerald-400',
    refrigerator: 'bg-sky-500/10 text-sky-400',
    other: 'bg-slate-500/10 text-slate-400'
  };
  return styles[type] || styles.other;
}
