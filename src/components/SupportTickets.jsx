import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supportService } from '../services/supportService';
import { organizationsService } from '../services/organizationsService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Search, Ticket, AlertCircle, Clock, CheckCircle2,
  ChevronDown, X, Filter
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function SupportTickets() {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [stats, setStats] = useState({ open: 0, critical: 0, avgResponseTime: 0, slaCompliance: 100 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);

  const [filters, setFilters] = useState({
    priority: 'all',
    status: 'all',
    category: 'all',
    organization_id: '',
    assigned_to: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tickets, activeTab, filters, user]);

  async function loadData() {
    try {
      const results = await Promise.allSettled([
        supportService.getTickets(),
        supportService.getStats(),
        organizationsService.getAll(),
        supportService.getStaffUsers()
      ]);

      if (results[0].status === 'fulfilled') {
        setTickets(results[0].value);
      } else {
        console.error('Error loading tickets:', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        setStats(results[1].value);
      }

      if (results[2].status === 'fulfilled') {
        setOrganizations(results[2].value);
      } else {
        console.error('Error loading organizations:', results[2].reason);
      }

      if (results[3].status === 'fulfilled') {
        setStaffUsers(results[3].value);
      }
    } catch (error) {
      console.error('Error loading support data:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...tickets];

    if (activeTab === 'my') {
      filtered = filtered.filter(t => t.assigned_to === user?.id);
    } else if (activeTab === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(t => t.priority === filters.priority);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.organization_id) {
      filtered = filtered.filter(t => t.organization_id === filters.organization_id);
    }

    if (filters.assigned_to) {
      filtered = filtered.filter(t => t.assigned_to === filters.assigned_to);
    }

    setFilteredTickets(filtered);
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleTicketCreated = () => {
    setShowNewModal(false);
    loadData();
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      critical: { label: 'Critical', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
      high: { label: 'High', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      normal: { label: 'Normal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      low: { label: 'Low', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
    };
    return badges[priority] || badges.normal;
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { label: 'Open', color: 'bg-blue-500/10 text-blue-400' },
      in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-400' },
      pending_client: { label: 'Pending Client', color: 'bg-orange-500/10 text-orange-400' },
      resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-400' },
      closed: { label: 'Closed', color: 'bg-slate-500/10 text-slate-400' }
    };
    return badges[status] || badges.open;
  };

  const isSLABreached = (ticket) => {
    if (!ticket.sla_deadline) return false;
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return ticket.resolved_at && new Date(ticket.resolved_at) > new Date(ticket.sla_deadline);
    }
    return new Date() > new Date(ticket.sla_deadline);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
          <p className="text-slate-400 text-sm mt-1">Manage customer support requests</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          New Ticket
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.open}</p>
              <p className="text-xs text-slate-400">Open Tickets</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.critical}</p>
              <p className="text-xs text-slate-400">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.avgResponseTime}h</p>
              <p className="text-xs text-slate-400">Avg Response</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.slaCompliance}%</p>
              <p className="text-xs text-slate-400">SLA Compliance</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="border-b border-slate-700">
          <div className="flex gap-1 p-2">
            {[
              { id: 'all', label: 'All Tickets' },
              { id: 'my', label: 'My Tickets' },
              { id: 'unassigned', label: 'Unassigned' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_client">Pending Client</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="equipment">Equipment</option>
                <option value="lis">LIS</option>
                <option value="compliance">Compliance</option>
                <option value="training">Training</option>
                <option value="billing">Billing</option>
                <option value="other">Other</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.organization_id}
                onChange={(e) => handleFilterChange('organization_id', e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">All Clients</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={filters.assigned_to}
                onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="">All Assignees</option>
                {staffUsers.map(staff => (
                  <option key={staff.user_id} value={staff.user_id}>
                    {staff.display_name || staff.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Ticket</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => {
                  const priorityBadge = getPriorityBadge(ticket.priority);
                  const statusBadge = getStatusBadge(ticket.status);
                  const breached = isSLABreached(ticket);

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/support/${ticket.id}`} className="group">
                          <div className="text-teal-400 font-mono text-sm group-hover:text-teal-300">
                            {ticket.ticket_number}
                          </div>
                          <div className="text-white font-medium group-hover:text-teal-400 transition-colors">
                            {ticket.subject}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white text-sm">{ticket.organization?.name || '-'}</div>
                        {ticket.site && (
                          <div className="text-slate-400 text-xs">{ticket.site.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${priorityBadge.color}`}>
                          {priorityBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm capitalize">
                        {ticket.category || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-300 text-sm">
                        {staffUsers.find(s => s.user_id === ticket.assigned_to)?.display_name ||
                         staffUsers.find(s => s.user_id === ticket.assigned_to)?.email?.split('@')[0] || '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`w-3 h-3 rounded-full ${breached ? 'bg-red-500' : 'bg-green-500'}`} title={breached ? 'SLA Breached' : 'Within SLA'} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewTicketModal
          organizations={organizations}
          staffUsers={staffUsers}
          onClose={() => setShowNewModal(false)}
          onCreated={handleTicketCreated}
        />
      )}
    </div>
  );
}

function NewTicketModal({ organizations, staffUsers, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    organization_id: '',
    site_id: '',
    subject: '',
    description: '',
    priority: 'normal',
    category: 'other',
    assigned_to: ''
  });
  const [sites, setSites] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (formData.organization_id) {
      loadSites(formData.organization_id);
    } else {
      setSites([]);
      setFormData(prev => ({ ...prev, site_id: '' }));
    }
  }, [formData.organization_id]);

  async function loadSites(orgId) {
    const { data } = await supabase
      .from('facilities')
      .select('id, name, city, state')
      .eq('organization_id', orgId)
      .order('name');

    setSites(data || []);
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.organization_id || !formData.subject || !formData.description) {
      setError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const ticketData = {
        ...formData,
        site_id: formData.site_id || null,
        assigned_to: formData.assigned_to || null
      };
      await supportService.createTicket(ticketData);
      onCreated();
    } catch (err) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">New Support Ticket</h2>
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
                Site (optional)
              </label>
              <select
                name="site_id"
                value={formData.site_id}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                disabled={!formData.organization_id}
              >
                <option value="">Select site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name} - {site.city}, {site.state}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Subject *
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                placeholder="Detailed description of the issue..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="equipment">Equipment</option>
                  <option value="lis">LIS</option>
                  <option value="compliance">Compliance</option>
                  <option value="training">Training</option>
                  <option value="billing">Billing</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Assign To
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Unassigned</option>
                {staffUsers.map(staff => (
                  <option key={staff.user_id} value={staff.user_id}>
                    {staff.display_name || staff.email}
                  </option>
                ))}
              </select>
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
              {saving ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
