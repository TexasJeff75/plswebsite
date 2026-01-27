import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { milestonesService, equipmentService } from '../services/milestonesService';
import { useAuth } from '../contexts/AuthContext';

export default function FacilityDetail() {
  const { id } = useParams();
  const { isEditor } = useAuth();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFacility();
  }, [id]);

  async function loadFacility() {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading facility with ID:', id);
      const data = await facilitiesService.getById(id);
      console.log('Facility loaded:', data);
      setFacility(data);
    } catch (err) {
      console.error('Error loading facility:', err);
      setError(err.message || 'Failed to load facility');
    } finally {
      setLoading(false);
    }
  }

  async function handleMilestoneStatusChange(milestoneId, newStatus) {
    try {
      await milestonesService.updateStatus(milestoneId, newStatus);
      await loadFacility();
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  }

  async function handleEquipmentStatusChange(equipmentId, newStatus) {
    try {
      await equipmentService.updateStatus(equipmentId, newStatus);
      await loadFacility();
    } catch (error) {
      console.error('Error updating equipment:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading facility details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-400 font-medium mb-2">Error Loading Facility</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <Link to="/facilities" className="text-teal-400 hover:text-teal-300 inline-block">
            ← Back to Facilities
          </Link>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Facility not found</p>
        <Link to="/facilities" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
          ← Back to Facilities
        </Link>
      </div>
    );
  }

  const statusColors = {
    'Not Started': 'bg-slate-700 text-slate-300',
    'In Progress': 'bg-blue-600 text-white',
    'Complete': 'bg-green-600 text-white',
    'Blocked': 'bg-red-600 text-white',
    'Live': 'bg-green-600 text-white'
  };

  const sortedMilestones = [...(facility.milestones || [])].sort((a, b) => a.milestone_order - b.milestone_order);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/facilities" className="text-slate-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{facility.name}</h1>
          <p className="text-slate-400">{facility.address}, {facility.city}, {facility.state} {facility.zip}</p>
        </div>
        <span className={`px-4 py-2 rounded-lg text-sm font-medium ${statusColors[facility.status]}`}>
          {facility.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Phase</h3>
          <p className="text-2xl font-bold text-white">{facility.phase}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Region</h3>
          <p className="text-2xl font-bold text-white">{facility.region || 'N/A'}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-slate-400 text-sm font-medium mb-2">Projected Go-Live</h3>
          <p className="text-2xl font-bold text-white">
            {facility.projected_go_live
              ? new Date(facility.projected_go_live).toLocaleDateString()
              : 'Not Set'}
          </p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-bold text-white mb-6">Milestones</h2>
        <div className="space-y-4">
          {sortedMilestones.map(milestone => (
            <div key={milestone.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-slate-500 font-medium">#{milestone.milestone_order}</span>
                    <h3 className="text-white font-medium">{milestone.milestone_name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[milestone.status]}`}>
                      {milestone.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    {milestone.start_date && (
                      <span>Started: {new Date(milestone.start_date).toLocaleDateString()}</span>
                    )}
                    {milestone.completion_date && (
                      <span>Completed: {new Date(milestone.completion_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                {isEditor && (
                  <select
                    value={milestone.status}
                    onChange={(e) => handleMilestoneStatusChange(milestone.id, e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Complete">Complete</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {facility.equipment && facility.equipment.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold text-white mb-6">Equipment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facility.equipment.map(item => (
              <div key={item.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">{item.device_type}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    item.status === 'Trained' ? 'bg-green-600 text-white' :
                    item.status === 'Validated' ? 'bg-blue-600 text-white' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {item.status}
                  </span>
                </div>
                {isEditor && (
                  <select
                    value={item.status}
                    onChange={(e) => handleEquipmentStatusChange(item.id, e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="Ordered">Ordered</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Installed">Installed</option>
                    <option value="Validated">Validated</option>
                    <option value="Trained">Trained</option>
                  </select>
                )}
                {item.serial_number && (
                  <p className="text-slate-400 text-sm mt-2">SN: {item.serial_number}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
