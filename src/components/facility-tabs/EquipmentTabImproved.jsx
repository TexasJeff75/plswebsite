import React, { useState, useEffect } from 'react';
import { Package, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Copy, Zap, Clock } from 'lucide-react';
import { facilitiesService } from '../../services/facilitiesService';
import { useAutoSave, useKeyboardShortcuts } from '../../hooks/useAutoSave';

const EQUIPMENT_TYPES = [
  { id: 'genexpert', name: 'Cepheid GeneXpert V2' },
  { id: 'clarity', name: 'Clarity Platinum' },
  { id: 'epoc', name: 'EPOC Blood Analysis' },
  { id: 'abacus', name: 'Abacus Cell Counter' },
];

const STATUS_FLOW = ['not_ordered', 'ordered', 'shipped', 'delivered', 'installed', 'validated', 'operational'];
const STATUS_LABELS = {
  not_ordered: 'Not Ordered',
  ordered: 'Ordered',
  shipped: 'Shipped',
  delivered: 'Delivered',
  installed: 'Installed',
  validated: 'Validated',
  operational: 'Operational',
};

export default function EquipmentTabImproved({ facility, isEditor, onUpdate }) {
  const [equipment, setEquipment] = useState([]);
  const [editedEquipment, setEditedEquipment] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [compactMode, setCompactMode] = useState(false);
  const [bulkStatusMode, setBulkStatusMode] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(new Set());
  const [lastSaveTime, setLastSaveTime] = useState({});
  const [activeEquipment, setActiveEquipment] = useState(null);

  useEffect(() => {
    if (facility?.equipment) {
      setEquipment(facility.equipment);
      const initial = {};
      const expanded = {};
      facility.equipment.forEach(eq => {
        initial[eq.equipment_type] = { ...eq };
        expanded[eq.equipment_type] = false;
      });
      setEditedEquipment(initial);
      setExpandedSections(expanded);
    }
  }, [facility?.equipment]);

  useKeyboardShortcuts([
    {
      key: 's',
      ctrlKey: true,
      callback: () => {
        if (activeEquipment) {
          handleSave(activeEquipment);
        }
      }
    },
    {
      key: 'b',
      ctrlKey: true,
      callback: () => {
        if (isEditor) {
          setBulkStatusMode(!bulkStatusMode);
        }
      }
    },
    {
      key: 'e',
      ctrlKey: true,
      callback: () => {
        const allExpanded = Object.values(expandedSections).every(v => v);
        const newState = {};
        Object.keys(expandedSections).forEach(key => {
          newState[key] = !allExpanded;
        });
        setExpandedSections(newState);
      }
    }
  ]);

  const getStatusColor = (status) => {
    const colors = {
      not_ordered: 'bg-slate-700',
      ordered: 'bg-blue-700',
      shipped: 'bg-cyan-700',
      delivered: 'bg-teal-700',
      installed: 'bg-emerald-700',
      validated: 'bg-amber-700',
      operational: 'bg-green-700',
    };
    return colors[status] || 'bg-slate-700';
  };

  const handleFieldChange = (equipmentType, field, value) => {
    setEditedEquipment(prev => ({
      ...prev,
      [equipmentType]: {
        ...prev[equipmentType],
        [field]: value
      }
    }));
    setActiveEquipment(equipmentType);

    if (field === 'equipment_status') {
      handleAutoSave(equipmentType, { ...editedEquipment[equipmentType], [field]: value });
    }
  };

  const handleAutoSave = async (equipmentType, data) => {
    try {
      const equipmentData = data || editedEquipment[equipmentType];
      const existingEquipment = equipment.find(e => e.equipment_type === equipmentType);

      let result;
      if (existingEquipment?.id) {
        result = await facilitiesService.updateEquipment(existingEquipment.id, equipmentData);
      } else {
        result = await facilitiesService.createEquipment({
          ...equipmentData,
          facility_id: facility.id,
          equipment_type: equipmentType,
          display_name: EQUIPMENT_TYPES.find(t => t.id === equipmentType)?.name
        });
      }

      setEquipment(prev => {
        const updated = prev.filter(e => e.equipment_type !== equipmentType);
        return [...updated, result];
      });

      setLastSaveTime(prev => ({ ...prev, [equipmentType]: new Date() }));

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error auto-saving equipment:', error);
    }
  };

  const handleSave = async (equipmentType) => {
    await handleAutoSave(equipmentType);
  };

  const toggleSection = (equipmentType) => {
    setExpandedSections(prev => ({
      ...prev,
      [equipmentType]: !prev[equipmentType]
    }));
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedEquipment.size === 0) return;

    try {
      const promises = Array.from(selectedEquipment).map(equipmentType => {
        const updated = {
          ...editedEquipment[equipmentType],
          equipment_status: newStatus
        };
        setEditedEquipment(prev => ({
          ...prev,
          [equipmentType]: updated
        }));
        return handleAutoSave(equipmentType, updated);
      });

      await Promise.all(promises);
      setSelectedEquipment(new Set());
      setBulkStatusMode(false);
    } catch (error) {
      console.error('Error updating bulk status:', error);
      alert('Failed to update equipment status');
    }
  };

  const copyEquipmentData = (fromType, toType) => {
    const source = editedEquipment[fromType];
    if (!source) return;

    const copied = {
      ...source,
      equipment_type: toType,
      display_name: EQUIPMENT_TYPES.find(t => t.id === toType)?.name,
      serial_number: '',
      tracking_number: '',
      order_number: ''
    };

    setEditedEquipment(prev => ({
      ...prev,
      [toType]: copied
    }));
  };

  const getRelevantFields = (status) => {
    const phases = {
      not_ordered: [],
      ordered: ['procurement'],
      shipped: ['procurement', 'shipping'],
      delivered: ['procurement', 'shipping'],
      installed: ['procurement', 'shipping', 'installation'],
      validated: ['procurement', 'shipping', 'installation', 'qc'],
      operational: ['procurement', 'shipping', 'installation', 'qc']
    };
    return phases[status] || [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-white">Equipment Management</h3>
        </div>

        {isEditor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompactMode(!compactMode)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors"
              title="Toggle compact mode"
            >
              {compactMode ? 'Expanded' : 'Compact'}
            </button>
            <button
              onClick={() => setBulkStatusMode(!bulkStatusMode)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                bulkStatusMode
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
              title="Bulk status update (Ctrl+B)"
            >
              <Zap className="w-4 h-4 inline mr-1" />
              Bulk Actions
            </button>
          </div>
        )}
      </div>

      {bulkStatusMode && selectedEquipment.size > 0 && (
        <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-teal-300 text-sm">
              {selectedEquipment.size} item{selectedEquipment.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <select
                onChange={(e) => handleBulkStatusUpdate(e.target.value)}
                className="bg-slate-700 text-white px-3 py-1.5 rounded text-sm border border-slate-600"
              >
                <option value="">Update Status</option>
                {STATUS_FLOW.map(status => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setSelectedEquipment(new Set());
                  setBulkStatusMode(false);
                }}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-xs text-slate-500 flex items-center gap-4">
        <span>💡 Tip: Status changes auto-save immediately</span>
        <span>⌨️ Ctrl+B: Bulk actions</span>
        <span>⌨️ Ctrl+E: Expand/collapse all</span>
      </div>

      {EQUIPMENT_TYPES.map(type => {
        const equip = editedEquipment[type.id] || {
          equipment_type: type.id,
          display_name: type.name,
          equipment_status: 'not_ordered',
        };
        const isExpanded = expandedSections[type.id];
        const isSelected = selectedEquipment.has(type.id);
        const relevantFields = getRelevantFields(equip.equipment_status);
        const saveTime = lastSaveTime[type.id];

        return (
          <div
            key={type.id}
            className={`bg-slate-800 rounded-lg border transition-all ${
              isSelected ? 'border-teal-500' : 'border-slate-700'
            }`}
          >
            <div className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 flex-1">
                  {bulkStatusMode && isEditor && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const newSelected = new Set(selectedEquipment);
                        if (e.target.checked) {
                          newSelected.add(type.id);
                        } else {
                          newSelected.delete(type.id);
                        }
                        setSelectedEquipment(newSelected);
                      }}
                      className="w-4 h-4"
                    />
                  )}
                  <div>
                    <h4 className="text-white font-semibold">{type.name}</h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {type.id}
                      {saveTime && (
                        <span className="ml-2 text-slate-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Saved {new Date(saveTime).toLocaleTimeString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditor && (
                    <select
                      value={equip.equipment_status}
                      onChange={(e) => handleFieldChange(type.id, 'equipment_status', e.target.value)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${getStatusColor(equip.equipment_status)} border-none`}
                    >
                      {STATUS_FLOW.map(status => (
                        <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                      ))}
                    </select>
                  )}

                  {!isEditor && (
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${getStatusColor(equip.equipment_status)}`}>
                      {STATUS_LABELS[equip.equipment_status] || 'Unknown'}
                    </span>
                  )}

                  <button
                    onClick={() => toggleSection(type.id)}
                    className="p-1 hover:bg-slate-700 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {!compactMode && (
                <div className="mb-3">
                  <div className="flex gap-1">
                    {STATUS_FLOW.map(status => (
                      <div
                        key={status}
                        className={`h-1 flex-1 rounded ${
                          STATUS_FLOW.indexOf(equip.equipment_status) >= STATUS_FLOW.indexOf(status)
                            ? 'bg-teal-500'
                            : 'bg-slate-700'
                        }`}
                        title={STATUS_LABELS[status]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="space-y-4 mt-4 pt-4 border-t border-slate-700">
                  {relevantFields.includes('procurement') && (
                    <div className="bg-slate-700/50 rounded p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-slate-300 font-semibold text-sm">Procurement</h5>
                        {isEditor && EQUIPMENT_TYPES.findIndex(t => t.id === type.id) > 0 && (
                          <button
                            onClick={() => {
                              const prevType = EQUIPMENT_TYPES[EQUIPMENT_TYPES.findIndex(t => t.id === type.id) - 1];
                              copyEquipmentData(prevType.id, type.id);
                            }}
                            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                            title="Copy from previous equipment"
                          >
                            <Copy className="w-3 h-3" />
                            Copy from above
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Method</label>
                          <select
                            value={equip.procurement_method || ''}
                            onChange={(e) => handleFieldChange(type.id, 'procurement_method', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          >
                            <option value="">Select</option>
                            <option value="reagent_rental">Reagent Rental</option>
                            <option value="purchase">Purchase</option>
                            <option value="lease">Lease</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Order #</label>
                          <input
                            type="text"
                            value={equip.order_number || ''}
                            onChange={(e) => handleFieldChange(type.id, 'order_number', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Order Date</label>
                          <input
                            type="date"
                            value={equip.order_date || ''}
                            onChange={(e) => handleFieldChange(type.id, 'order_date', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {relevantFields.includes('shipping') && (
                    <div className="bg-slate-700/50 rounded p-3 space-y-3">
                      <h5 className="text-slate-300 font-semibold text-sm">Shipping</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Carrier</label>
                          <input
                            type="text"
                            value={equip.carrier || ''}
                            onChange={(e) => handleFieldChange(type.id, 'carrier', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                            placeholder="FedEx, UPS, etc."
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Tracking #</label>
                          <input
                            type="text"
                            value={equip.tracking_number || ''}
                            onChange={(e) => handleFieldChange(type.id, 'tracking_number', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Ship Date</label>
                          <input
                            type="date"
                            value={equip.ship_date || ''}
                            onChange={(e) => handleFieldChange(type.id, 'ship_date', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Delivery Date</label>
                          <input
                            type="date"
                            value={equip.delivery_date || ''}
                            onChange={(e) => handleFieldChange(type.id, 'delivery_date', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {relevantFields.includes('installation') && (
                    <div className="bg-slate-700/50 rounded p-3 space-y-3">
                      <h5 className="text-slate-300 font-semibold text-sm">Installation</h5>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Serial #</label>
                          <input
                            type="text"
                            value={equip.serial_number || ''}
                            onChange={(e) => handleFieldChange(type.id, 'serial_number', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Installed By</label>
                          <input
                            type="text"
                            value={equip.installed_by || ''}
                            onChange={(e) => handleFieldChange(type.id, 'installed_by', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">Install Date</label>
                          <input
                            type="date"
                            value={equip.installed_date || ''}
                            onChange={(e) => handleFieldChange(type.id, 'installed_date', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {relevantFields.includes('qc') && (
                    <div className="bg-slate-700/50 rounded p-3 space-y-3">
                      <h5 className="text-slate-300 font-semibold text-sm">Quality Control</h5>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={equip.initial_qc_performed || false}
                            onChange={(e) => {
                              handleFieldChange(type.id, 'initial_qc_performed', e.target.checked);
                              handleSave(type.id);
                            }}
                            disabled={!isEditor}
                            className="w-4 h-4"
                          />
                          <label className="text-slate-300 text-sm">QC Performed</label>
                          {equip.initial_qc_performed && (
                            <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                          )}
                        </div>
                        <div>
                          <label className="text-slate-400 text-xs mb-1 block">QC Date</label>
                          <input
                            type="date"
                            value={equip.initial_qc_date || ''}
                            onChange={(e) => handleFieldChange(type.id, 'initial_qc_date', e.target.value)}
                            onBlur={() => handleSave(type.id)}
                            disabled={!isEditor}
                            className="w-full bg-slate-600 text-white px-2 py-1.5 rounded text-sm border border-slate-500 disabled:opacity-50"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={equip.initial_qc_acceptable || false}
                            onChange={(e) => {
                              handleFieldChange(type.id, 'initial_qc_acceptable', e.target.checked);
                              handleSave(type.id);
                            }}
                            disabled={!isEditor}
                            className="w-4 h-4"
                          />
                          <label className="text-slate-300 text-sm">QC Acceptable</label>
                          {equip.initial_qc_acceptable ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
                          ) : (
                            equip.initial_qc_performed && <AlertCircle className="w-4 h-4 text-red-500 ml-auto" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Notes</label>
                    <textarea
                      value={equip.notes || ''}
                      onChange={(e) => handleFieldChange(type.id, 'notes', e.target.value)}
                      onBlur={() => handleSave(type.id)}
                      disabled={!isEditor}
                      rows="2"
                      placeholder="Add notes..."
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
