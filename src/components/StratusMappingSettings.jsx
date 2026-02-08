import React, { useState, useEffect } from 'react';
import { stratusMappingService } from '../services/stratusMappingService';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import {
  Link, Plus, X, Pencil, Trash2, Save, Power, TestTube2,
  Building2, MapPin, CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

export default function StratusMappingSettings() {
  const [mappings, setMappings] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [formData, setFormData] = useState({
    organization_id: '',
    facility_id: '',
    stratus_facility_identifier: '',
    stratus_organization_identifier: '',
    mapping_type: 'exact',
    is_active: true,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [mappingsData, orgsData, statsData] = await Promise.all([
        stratusMappingService.getMappings(),
        organizationsService.getAll(),
        stratusMappingService.getMappingStats(),
      ]);
      setMappings(mappingsData);
      setOrganizations(orgsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFacilities(organizationId) {
    if (!organizationId) {
      setFacilities([]);
      return;
    }
    try {
      const data = await facilitiesService.getAll({ organization_id: organizationId });
      setFacilities(data);
    } catch (error) {
      console.error('Error loading facilities:', error);
    }
  }

  function openCreateModal() {
    setEditingMapping(null);
    setFormData({
      organization_id: '',
      facility_id: '',
      stratus_facility_identifier: '',
      stratus_organization_identifier: '',
      mapping_type: 'exact',
      is_active: true,
      notes: '',
    });
    setTestResult(null);
    setShowModal(true);
  }

  async function openEditModal(mapping) {
    setEditingMapping(mapping);
    setFormData({
      organization_id: mapping.organization_id,
      facility_id: mapping.facility_id || '',
      stratus_facility_identifier: mapping.stratus_facility_identifier,
      stratus_organization_identifier: mapping.stratus_organization_identifier || '',
      mapping_type: mapping.mapping_type,
      is_active: mapping.is_active,
      notes: mapping.notes || '',
    });
    setTestResult(null);
    await loadFacilities(mapping.organization_id);
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingMapping) {
        await stratusMappingService.updateMapping(editingMapping.id, formData);
      } else {
        await stratusMappingService.createMapping(formData);
      }
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving mapping:', error);
      alert('Failed to save mapping: ' + error.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    try {
      await stratusMappingService.deleteMapping(id);
      loadData();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Failed to delete mapping: ' + error.message);
    }
  }

  async function handleToggleActive(id, currentStatus) {
    try {
      await stratusMappingService.toggleActive(id, !currentStatus);
      loadData();
    } catch (error) {
      console.error('Error toggling mapping:', error);
      alert('Failed to toggle mapping: ' + error.message);
    }
  }

  async function handleTestMapping() {
    if (!formData.stratus_facility_identifier) {
      alert('Please enter a StratusDX facility identifier to test');
      return;
    }
    try {
      const result = await stratusMappingService.testMapping(
        formData.stratus_facility_identifier,
        formData.stratus_organization_identifier || null
      );
      setTestResult(result);
    } catch (error) {
      console.error('Error testing mapping:', error);
      setTestResult({ error: error.message });
    }
  }

  function handleOrganizationChange(orgId) {
    setFormData({ ...formData, organization_id: orgId, facility_id: '' });
    loadFacilities(orgId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">StratusDX Facility Mappings</h3>
          <p className="text-slate-400 text-sm">
            Map StratusDX facility identifiers to your organizations and facilities
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Mapping
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-slate-400">Total Mappings</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.active}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400">Inactive</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.inactive}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TestTube2 className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Total Matches</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_matches}</p>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  StratusDX Identifier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Matches
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center">
                    <Link className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-4">No mappings configured yet</p>
                    <button
                      onClick={openCreateModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Mapping
                    </button>
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-400" />
                        <div>
                          <p className="text-white font-medium text-sm">
                            {mapping.stratus_facility_identifier}
                          </p>
                          {mapping.stratus_organization_identifier && (
                            <p className="text-slate-400 text-xs">
                              Org: {mapping.stratus_organization_identifier}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-white text-sm">{mapping.organization?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {mapping.facility ? (
                        <div>
                          <p className="text-white text-sm">{mapping.facility.name}</p>
                          <p className="text-slate-400 text-xs">
                            {mapping.facility.city}, {mapping.facility.state}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-sm">Organization Level</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs font-medium">
                        {mapping.mapping_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {mapping.is_active ? (
                        <span className="flex items-center gap-1 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-500 text-sm">
                          <XCircle className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">{mapping.match_count || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(mapping.id, mapping.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            mapping.is_active
                              ? 'text-green-400 hover:bg-green-500/10'
                              : 'text-slate-500 hover:bg-slate-700'
                          }`}
                          title={mapping.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(mapping)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
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
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingMapping ? 'Edit Mapping' : 'Create New Mapping'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    StratusDX Facility Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.stratus_facility_identifier}
                    onChange={(e) => setFormData({ ...formData, stratus_facility_identifier: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g., Facility-123 or Clinic Name"
                  />
                  <p className="text-slate-400 text-xs mt-1">
                    The identifier used in StratusDX API responses (facility name, ID, etc.)
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    StratusDX Organization Identifier
                  </label>
                  <input
                    type="text"
                    value={formData.stratus_organization_identifier}
                    onChange={(e) => setFormData({ ...formData, stratus_organization_identifier: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="Optional - for additional matching"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Organization *
                  </label>
                  <select
                    required
                    value={formData.organization_id}
                    onChange={(e) => handleOrganizationChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">Select organization...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Facility
                  </label>
                  <select
                    value={formData.facility_id}
                    onChange={(e) => setFormData({ ...formData, facility_id: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    disabled={!formData.organization_id}
                  >
                    <option value="">Organization level (all facilities)</option>
                    {facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>
                        {facility.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Mapping Type
                  </label>
                  <select
                    value={formData.mapping_type}
                    onChange={(e) => setFormData({ ...formData, mapping_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="exact">Exact Match</option>
                    <option value="contains">Contains</option>
                    <option value="pattern">Pattern (Regex)</option>
                  </select>
                  <p className="text-slate-400 text-xs mt-1">
                    {formData.mapping_type === 'exact' && 'Exact string match'}
                    {formData.mapping_type === 'contains' && 'Partial string match (case-insensitive)'}
                    {formData.mapping_type === 'pattern' && 'Regular expression pattern'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Status
                  </label>
                  <div className="flex items-center gap-3 h-[42px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500"
                      />
                      <span className="text-white text-sm">Active</span>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 resize-none"
                    placeholder="Optional notes about this mapping..."
                  />
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={handleTestMapping}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                  >
                    <TestTube2 className="w-4 h-4" />
                    Test Mapping
                  </button>
                  {testResult && (
                    <div className="flex items-center gap-2">
                      {testResult.error ? (
                        <span className="flex items-center gap-2 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" />
                          Error: {testResult.error}
                        </span>
                      ) : testResult.organization_id ? (
                        <span className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Match found!
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-yellow-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          No match found
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-700 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
                >
                  <Save className="w-4 h-4" />
                  {editingMapping ? 'Update Mapping' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
