import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';

const MILESTONE_NAMES = [
  'Site Assessment',
  'CLIA Certificate Obtained',
  'Lab Director Assigned',
  'Equipment Ordered',
  'Equipment Installed',
  'Network/LIS Integration',
  'Staff Training Complete',
  'Competency Assessment Done',
  'Go-Live'
];

const EQUIPMENT_DEVICES = [
  { name: 'Siemens epoc', type: 'blood_gas' },
  { name: 'Diatron Abacus 3', type: 'cbc' },
  { name: 'Clarity Platinum', type: 'urinalysis' },
  { name: 'Cepheid GeneXpert', type: 'molecular' }
];

const EQUIPMENT_STATUSES = ['not_ordered', 'ordered', 'shipped', 'delivered', 'installed', 'validated'];
const MILESTONE_STATUSES = ['not_started', 'in_progress', 'complete', 'blocked'];

export default function FacilityDetailPanel({ facility, onClose, onSave }) {
  const [milestones, setMilestones] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [notes, setNotes] = useState(facility.general_notes || '');
  const [projectedGoLive, setProjectedGoLive] = useState(facility.projected_go_live || '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [facility.id]);

  const loadData = async () => {
    try {
      const fullFacility = await facilitiesService.getById(facility.id);

      let sortedMilestones = fullFacility.milestones || [];
      if (Array.isArray(sortedMilestones)) {
        sortedMilestones = sortedMilestones.sort((a, b) => {
          const aNum = a.milestone_order || 0;
          const bNum = b.milestone_order || 0;
          return aNum - bNum;
        });
      }
      setMilestones(sortedMilestones);
      setEquipment(fullFacility.equipment || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading facility details:', error);
      setLoading(false);
    }
  };

  const handleMilestoneStatusChange = async (milestoneId, newStatus) => {
    const updated = milestones.map(m =>
      m.id === milestoneId ? { ...m, status: newStatus } : m
    );
    setMilestones(updated);
  };

  const handleMilestoneDateChange = (milestoneId, date) => {
    const updated = milestones.map(m =>
      m.id === milestoneId ? { ...m, completion_date: date } : m
    );
    setMilestones(updated);
  };

  const handleMilestoneNotesChange = (milestoneId, notesText) => {
    const updated = milestones.map(m =>
      m.id === milestoneId ? { ...m, notes: notesText } : m
    );
    setMilestones(updated);
  };

  const handleEquipmentStatusChange = async (equipmentId, newStatus) => {
    const updated = equipment.map(e =>
      e.id === equipmentId ? { ...e, status: newStatus } : e
    );
    setEquipment(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await facilitiesService.update(facility.id, {
        general_notes: notes,
        projected_go_live: projectedGoLive || null
      });

      for (const milestone of milestones) {
        await facilitiesService.updateMilestone(milestone.id, {
          status: milestone.status,
          completion_date: milestone.completion_date,
          notes: milestone.notes
        });
      }

      for (const item of equipment) {
        await facilitiesService.updateEquipment(item.id, {
          status: item.status,
          delivery_date: item.delivery_date
        });
      }

      setSaving(false);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving facility:', error);
      setSaving(false);
    }
  };

  const getMilestoneIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-5 h-5 text-teal-400" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-amber-400" />;
      case 'blocked':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-slate-600" />;
    }
  };

  const completedCount = milestones.filter(m => m.status === 'complete').length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-screen w-96 bg-slate-900 border-l border-slate-700 overflow-y-auto shadow-2xl z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex-none border-b border-slate-700 p-4">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-bold text-white">{facility.name}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
            facility.status === 'live' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
            facility.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            facility.status === 'blocked' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
            'bg-slate-700/50 text-slate-300 border border-slate-600/50'
          }`}>
            {facility.status === 'not_started' ? 'Not Started' :
             facility.status === 'in_progress' ? 'In Progress' :
             facility.status === 'live' ? 'Live' :
             facility.status === 'blocked' ? 'Blocked' : 'Unknown'}
          </span>
          <span className="text-sm text-slate-400">
            {completedCount}/{MILESTONE_NAMES.length} complete
          </span>
        </div>

        <p className="text-sm text-slate-300">{facility.address}</p>
        <p className="text-sm text-slate-400">{facility.city}, {facility.state} {facility.zip}</p>
        {facility.region && (
          <p className="text-xs text-slate-500 mt-2">Region: {facility.region}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span className="text-teal-400">✓</span> Deployment Milestones
          </h3>
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-4 text-slate-400">Loading...</div>
            ) : milestones.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">No milestones found</div>
            ) : (
              milestones.map((milestone, idx) => (
                <div key={milestone.id} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    {getMilestoneIcon(milestone.status)}
                    <span className="text-sm font-medium text-white">{idx + 1}. {milestone.name}</span>
                  </div>

                  <select
                    value={milestone.status || 'not_started'}
                    onChange={(e) => handleMilestoneStatusChange(milestone.id, e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-600 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {MILESTONE_STATUSES.map(status => (
                      <option key={status} value={status}>
                        {status === 'not_started' ? 'Not Started' :
                         status === 'in_progress' ? 'In Progress' :
                         status === 'complete' ? 'Complete' :
                         status === 'blocked' ? 'Blocked' : status}
                      </option>
                    ))}
                  </select>

                  {(milestone.status === 'complete' || milestone.status === 'blocked') && (
                    <input
                      type="date"
                      value={milestone.completion_date || ''}
                      onChange={(e) => handleMilestoneDateChange(milestone.id, e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-600 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  )}

                  {milestone.status === 'blocked' && (
                    <textarea
                      value={milestone.notes || ''}
                      onChange={(e) => handleMilestoneNotesChange(milestone.id, e.target.value)}
                      placeholder="Blocking reason..."
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-600 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                      rows="2"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Equipment Tracking</h3>
          <div className="grid grid-cols-2 gap-2">
            {equipment.map(item => (
              <div key={item.id} className="bg-slate-800/50 rounded-lg p-2">
                <p className="text-xs font-medium text-white mb-2">{item.name}</p>
                <select
                  value={item.status || 'not_ordered'}
                  onChange={(e) => handleEquipmentStatusChange(item.id, e.target.value)}
                  className="w-full px-2 py-1 bg-slate-950 border border-slate-600 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {EQUIPMENT_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status === 'not_ordered' ? 'Not Ordered' :
                       status === 'ordered' ? 'Ordered' :
                       status === 'shipped' ? 'Shipped' :
                       status === 'delivered' ? 'Delivered' :
                       status === 'installed' ? 'Installed' :
                       status === 'validated' ? 'Validated' : status}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-2">General Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this facility..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            rows="4"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-2">Projected Go-Live</h3>
          <input
            type="date"
            value={projectedGoLive}
            onChange={(e) => setProjectedGoLive(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      <div className="flex-none border-t border-slate-700 p-4 bg-slate-800/50 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      </div>
    </>
  );
}
