import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Edit2 } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';

export default function FacilityDetailPanel({ facility, onClose, onSave }) {
  const [milestones, setMilestones] = useState([]);
  const [equipment, setEquipment] = useState([]);
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

  const getEquipmentStatusLight = (status) => {
    switch (status) {
      case 'validated':
      case 'installed':
        return <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />;
      case 'delivered':
      case 'shipped':
        return <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />;
      case 'ordered':
        return <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />;
    }
  };

  const getEquipmentStatusLabel = (status) => {
    switch (status) {
      case 'not_ordered':
        return 'Not Ordered';
      case 'ordered':
        return 'Ordered';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'installed':
        return 'Installed';
      case 'validated':
        return 'Validated';
      default:
        return 'Not Ordered';
    }
  };

  const getStatusLight = (status) => {
    switch (status) {
      case 'complete':
        return <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />;
      case 'in_progress':
        return <div className="w-4 h-4 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />;
      case 'blocked':
        return <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'in_progress':
        return 'In Progress';
      case 'blocked':
        return 'Blocked';
      default:
        return 'Not Started';
    }
  };

  const completedCount = milestones.filter(m => m.status === 'complete').length;
  const totalMilestones = milestones.length;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[2000]" onClick={onClose} />
      <div
        className="fixed right-0 top-0 h-screen w-96 bg-slate-900 border-l border-slate-700 overflow-y-auto shadow-2xl z-[2010] flex flex-col"
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
            {completedCount}/{totalMilestones} complete
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
                <div key={milestone.id} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusLight(milestone.status)}
                      <span className="text-sm font-medium text-white">{idx + 1}. {milestone.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {getStatusLabel(milestone.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Equipment Tracking</h3>
          <div className="space-y-2">
            {equipment.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">No equipment found</div>
            ) : (
              equipment.map(item => (
                <div key={item.id} className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getEquipmentStatusLight(item.status)}
                      <span className="text-sm font-medium text-white">{item.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {getEquipmentStatusLabel(item.status)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {facility.projected_go_live && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-2">Projected Go-Live</h3>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-sm text-white">{new Date(facility.projected_go_live).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-none border-t border-slate-700 p-4 bg-slate-800/50">
        <div className="flex gap-3">
          <Link
            to={`/facilities/${facility.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
