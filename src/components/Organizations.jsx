import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizationsService } from '../services/organizationsService';
import {
  Plus, Search, Building2, Users, DollarSign, Filter,
  MoreVertical, Eye, Pencil, Archive, X, ChevronDown
} from 'lucide-react';

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [filteredOrgs, setFilteredOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    filterOrganizations();
  }, [organizations, searchTerm, typeFilter, statusFilter]);

  async function loadOrganizations() {
    try {
      const data = await organizationsService.getWithStats();
      setOrganizations(data);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  }

  function filterOrganizations() {
    let filtered = [...organizations];

    if (searchTerm) {
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(org => org.client_type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(org => org.contract_status === statusFilter);
    }

    setFilteredOrgs(filtered);
  }

  const stats = {
    total: organizations.length,
    active: organizations.filter(o => o.contract_status === 'active').length,
    prospects: organizations.filter(o => o.client_type === 'prospect').length,
    totalMRR: organizations.reduce((sum, o) => sum + (o.monthly_recurring_revenue || 0), 0)
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  const getTypeBadge = (clientType) => {
    const badges = {
      mini_lab_network: { label: 'Network', color: 'bg-teal-600' },
      hosted_lab: { label: 'Hosted', color: 'bg-blue-600' },
      hybrid: { label: 'Hybrid', color: 'bg-cyan-600' },
      prospect: { label: 'Prospect', color: 'bg-slate-600' }
    };
    return badges[clientType] || badges.mini_lab_network;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { label: 'Active', color: 'text-green-400 bg-green-400/10' },
      pending: { label: 'Pending', color: 'text-amber-400 bg-amber-400/10' },
      terminated: { label: 'Terminated', color: 'text-red-400 bg-red-400/10' },
      suspended: { label: 'Suspended', color: 'text-slate-400 bg-slate-400/10' }
    };
    return badges[status] || badges.active;
  };

  const handleEdit = (org) => {
    setEditingOrg(org);
    setShowAddModal(true);
    setOpenMenuId(null);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingOrg(null);
  };

  const handleSave = async () => {
    await loadOrganizations();
    handleModalClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your organization accounts</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-slate-400">Total Clients</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
              <p className="text-xs text-slate-400">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.prospects}</p>
              <p className="text-xs text-slate-400">Prospects</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalMRR)}</p>
              <p className="text-xs text-slate-400">Total MRR</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="p-4 border-b border-slate-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="mini_lab_network">Network</option>
                  <option value="hosted_lab">Hosted</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="prospect">Prospect</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Sites</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Compliance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">MRR</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                      ? 'No clients match your filters'
                      : 'No clients found. Add your first client to get started.'}
                  </td>
                </tr>
              ) : (
                filteredOrgs.map(org => {
                  const typeBadge = getTypeBadge(org.client_type);
                  const statusBadge = getStatusBadge(org.contract_status);
                  const initials = org.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 3);

                  return (
                    <tr key={org.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/organizations/${org.id}`} className="flex items-center gap-3 group">
                          <div className={`w-10 h-10 ${typeBadge.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                            {initials}
                          </div>
                          <div>
                            <div className="text-white font-medium group-hover:text-teal-400 transition-colors">{org.name}</div>
                            <div className="text-slate-400 text-xs">
                              {org.totalFacilities} site{org.totalFacilities !== 1 ? 's' : ''} {org.region ? `in ${org.region}` : ''}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 ${typeBadge.color} text-white rounded-full text-xs font-semibold`}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white font-medium">
                        {org.liveFacilities} / {org.totalFacilities}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-700 rounded-full h-2 w-20">
                            <div
                              className={`h-2 rounded-full ${
                                org.complianceScore >= 90 ? 'bg-green-500' :
                                org.complianceScore >= 70 ? 'bg-amber-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${org.complianceScore}%` }}
                            />
                          </div>
                          <span className="text-white text-sm">{org.complianceScore}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-teal-400 font-semibold">
                        {formatCurrency(org.monthly_recurring_revenue)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-slate-400" />
                          </button>
                          {openMenuId === org.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20">
                                <Link
                                  to={`/organizations/${org.id}`}
                                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </Link>
                                <button
                                  onClick={() => handleEdit(org)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => setOpenMenuId(null)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <OrganizationModal
          organization={editingOrg}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function OrganizationModal({ organization, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    client_type: organization?.client_type || 'mini_lab_network',
    contract_status: organization?.contract_status || 'active',
    contract_number: organization?.contract_number || '',
    contract_start_date: organization?.contract_start_date || '',
    contract_end_date: organization?.contract_end_date || '',
    primary_contact_name: organization?.primary_contact_name || '',
    primary_contact_email: organization?.primary_contact_email || '',
    contact_phone: organization?.contact_phone || '',
    address: organization?.address || '',
    city: organization?.city || '',
    state: organization?.state || '',
    zip: organization?.zip || '',
    region: organization?.region || '',
    monthly_recurring_revenue: organization?.monthly_recurring_revenue || 0,
    notes: organization?.notes || ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'monthly_recurring_revenue' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (organization) {
        await organizationsService.update(organization.id, formData);
      } else {
        await organizationsService.create({
          ...formData,
          type: 'customer'
        });
      }
      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            {organization ? 'Edit Client' : 'Add New Client'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Enter organization name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Client Type
                </label>
                <select
                  name="client_type"
                  value={formData.client_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="mini_lab_network">Mini Lab Network</option>
                  <option value="hosted_lab">Hosted Lab</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  name="contract_status"
                  value={formData.contract_status}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Contract Number
                </label>
                <input
                  type="text"
                  name="contract_number"
                  value={formData.contract_number}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="e.g., CNT-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Region
                </label>
                <select
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select region</option>
                  <option value="midwest">Midwest</option>
                  <option value="southeast">Southeast</option>
                  <option value="southwest">Southwest</option>
                  <option value="northeast">Northeast</option>
                  <option value="west">West</option>
                  <option value="national">National</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Contract Start Date
                </label>
                <input
                  type="date"
                  name="contract_start_date"
                  value={formData.contract_start_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Contract End Date
                </label>
                <input
                  type="date"
                  name="contract_end_date"
                  value={formData.contract_end_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Monthly Recurring Revenue
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    name="monthly_recurring_revenue"
                    value={formData.monthly_recurring_revenue}
                    onChange={handleChange}
                    className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="0"
                    min="0"
                    step="100"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-white mb-4">Primary Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    name="primary_contact_name"
                    value={formData.primary_contact_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="primary_contact_email"
                    value={formData.primary_contact_email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="(555) 555-5555"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-sm font-medium text-white mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="123 Main St"
                  />
                </div>

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

                <div className="grid grid-cols-2 gap-4">
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
                      placeholder="ST"
                      maxLength="2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      ZIP
                    </label>
                    <input
                      type="text"
                      name="zip"
                      value={formData.zip}
                      onChange={handleChange}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                placeholder="Additional notes about this client..."
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
              {saving ? 'Saving...' : (organization ? 'Save Changes' : 'Create Client')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
