import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { organizationsService } from '../services/organizationsService';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus } from 'lucide-react';

export default function Facilities() {
  const { isEditor } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    region: '',
    phase: '',
    organization_id: ''
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    loadFacilities();
  }, [filters]);

  async function loadOrganizations() {
    try {
      const data = await organizationsService.getAll();
      setOrganizations(data.filter(org => org.type === 'customer'));
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  async function loadFacilities() {
    try {
      setLoading(true);
      const data = await facilitiesService.getAll(filters);
      setFacilities(data);
    } catch (error) {
      console.error('Error loading facilities:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusColors = {
    'Not Started': 'bg-slate-700 text-slate-300',
    'In Progress': 'bg-blue-600 text-white',
    'Live': 'bg-green-600 text-white',
    'Blocked': 'bg-red-600 text-white'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Facilities</h1>
          <p className="text-slate-400">Manage and monitor facility deployments</p>
        </div>
        {isEditor && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Facility
          </button>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search facilities..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          <select
            value={filters.organization_id}
            onChange={(e) => setFilters({ ...filters, organization_id: e.target.value })}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Clients</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Live">Live</option>
            <option value="Blocked">Blocked</option>
          </select>

          <input
            type="text"
            placeholder="Filter by region..."
            value={filters.region}
            onChange={(e) => setFilters({ ...filters, region: e.target.value })}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />

          <input
            type="text"
            placeholder="Filter by phase..."
            value={filters.phase}
            onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
            <p className="text-slate-400">Loading facilities...</p>
          </div>
        ) : facilities.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0h6"/>
            </svg>
            <p className="text-slate-400">No facilities found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Facility</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Client</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Location</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Phase</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Progress</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Go-Live</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map(facility => {
                  const completedMilestones = facility.milestones?.filter(m => m.status === 'Complete').length || 0;
                  const totalMilestones = facility.milestones?.length || 9;
                  const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

                  return (
                    <tr key={facility.id} className="border-b border-slate-800 hover:bg-slate-900/50 transition-colors">
                      <td className="py-4 px-4">
                        <Link to={`/facilities/${facility.id}`} className="text-white font-medium hover:text-teal-400">
                          {facility.name}
                        </Link>
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        {facility.organization?.name || '-'}
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        {facility.city}, {facility.state}
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        {facility.phase}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[facility.status] || 'bg-slate-700 text-slate-300'}`}>
                          {facility.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-teal-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 min-w-[3rem] text-right">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-400">
                        {facility.projected_go_live
                          ? new Date(facility.projected_go_live).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Link
                          to={`/facilities/${facility.id}`}
                          className="text-teal-400 hover:text-teal-300 text-sm font-medium"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddFacilityModal
          organizations={organizations}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadFacilities();
          }}
        />
      )}
    </div>
  );
}

function AddFacilityModal({ organizations, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    organization_id: '',
    name: '',
    address: '',
    city: '',
    state: '',
    facility_type: 'SNF',
    site_configuration: 'waived',
    projected_go_live: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.organization_id || !formData.name) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await facilitiesService.create({
        ...formData,
        projected_go_live: formData.projected_go_live || null,
        status: 'Not Started',
        phase: 'Phase 1'
      });
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create facility');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">Add New Facility</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Client *
              </label>
              <select
                name="organization_id"
                value={formData.organization_id}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                required
              >
                <option value="">Select client</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Facility Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                placeholder="Enter facility name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="State"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Facility Type
                </label>
                <select
                  name="facility_type"
                  value={formData.facility_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="SNF">SNF</option>
                  <option value="ALF">ALF</option>
                  <option value="Hospital">Hospital</option>
                  <option value="Clinic">Clinic</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Configuration
                </label>
                <select
                  name="site_configuration"
                  value={formData.site_configuration}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="waived">Waived</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High Complexity</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Projected Go-Live Date
              </label>
              <input
                type="date"
                name="projected_go_live"
                value={formData.projected_go_live}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700 bg-slate-800/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Facility'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
