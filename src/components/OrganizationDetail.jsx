import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import { projectsService } from '../services/projectsService';
import { organizationAssignmentsService } from '../services/organizationAssignmentsService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Building2, Users, FileText, CreditCard, MessageSquare,
  Activity, MapPin, Phone, Mail, Calendar, DollarSign, CheckCircle2,
  AlertCircle, Plus, Pencil, ExternalLink, Clock, UserPlus, Trash2, Folder
} from 'lucide-react';
import { format } from 'date-fns';
import { useOrganization } from '../contexts/OrganizationContext';

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isProximityAdmin } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [projects, setProjects] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadOrganization();
  }, [id]);

  async function loadOrganization() {
    try {
      const [orgData, orgWithStats] = await Promise.all([
        organizationsService.getById(id),
        organizationsService.getWithStats()
      ]);

      const stats = orgWithStats.find(o => o.id === id);
      setOrganization({ ...orgData, ...stats });

      const [projectsData, facilitiesData] = await Promise.all([
        projectsService.getAll({ organization_id: id }),
        supabase
          .from('facilities')
          .select('*, project:projects(id, name)')
          .eq('organization_id', id)
          .order('name')
      ]);

      setProjects(projectsData || []);
      setFacilities(facilitiesData.data || []);
    } catch (error) {
      console.error('Error loading organization:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading organization details...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Organization not found</p>
        <button
          onClick={() => navigate('/organizations')}
          className="mt-4 text-teal-400 hover:text-teal-300"
        >
          Back to Organizations
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'projects', label: 'Projects', icon: Folder },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'contacts', label: 'Contacts', icon: Mail },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'activity', label: 'Activity', icon: Activity }
  ];

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

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const typeBadge = getTypeBadge(organization.client_type);
  const statusBadge = getStatusBadge(organization.contract_status);
  const initials = organization.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/organizations')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className={`w-14 h-14 ${typeBadge.color} rounded-xl flex items-center justify-center text-white font-bold text-lg`}>
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{organization.name}</h1>
              <span className={`px-3 py-1 ${typeBadge.color} text-white rounded-full text-xs font-semibold`}>
                {typeBadge.label}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''}, {organization.totalFacilities || 0} facilit{organization.totalFacilities !== 1 ? 'ies' : 'y'} {organization.region ? `in ${organization.region}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-700">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-teal-400 border-teal-400'
                  : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <OverviewTab organization={organization} projects={projects} facilities={facilities} isProximityAdmin={isProximityAdmin} />
        )}
        {activeTab === 'projects' && (
          <ProjectsTab organization={organization} projects={projects} facilities={facilities} onRefresh={loadOrganization} />
        )}
        {activeTab === 'users' && (
          <UsersTab organization={organization} />
        )}
        {activeTab === 'billing' && (
          <BillingTab organization={organization} />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab organization={organization} />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab organization={organization} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab organization={organization} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ organization, projects, facilities, isProximityAdmin }) {
  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const liveSites = facilities.filter(f => f.deployment_phase === 'live').length;
  const inProgressSites = facilities.filter(f => f.deployment_phase === 'in_progress').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-slate-400">Total Projects</span>
            </div>
            <p className="text-2xl font-bold text-white">{projects.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-slate-400">Total Facilities</span>
            </div>
            <p className="text-2xl font-bold text-white">{facilities.length}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Live</span>
            </div>
            <p className="text-2xl font-bold text-white">{liveSites}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-white">{inProgressSites}</p>
          </div>
          {isProximityAdmin && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-400">MRR</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(organization.monthly_recurring_revenue)}</p>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Summary</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Overall Compliance</span>
                <span className="text-sm font-medium text-white">{organization.complianceScore || 0}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    (organization.complianceScore || 0) >= 90 ? 'bg-green-500' :
                    (organization.complianceScore || 0) >= 70 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${organization.complianceScore || 0}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-xl font-bold text-teal-400">{liveSites}</p>
                <p className="text-xs text-slate-400">CLIA Current</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-amber-400">0</p>
                <p className="text-xs text-slate-400">Expiring Soon</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-green-400">100%</p>
                <p className="text-xs text-slate-400">PT Pass Rate</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Facilities</h3>
          {facilities.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No facilities added yet</p>
          ) : (
            <div className="space-y-3">
              {facilities.slice(0, 5).map(facility => (
                <Link
                  key={facility.id}
                  to={`/facilities/${facility.id}`}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      facility.deployment_phase === 'live' ? 'bg-green-500/10 text-green-400' :
                      facility.deployment_phase === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{facility.name}</p>
                      <p className="text-slate-400 text-xs">{facility.city}, {facility.state}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    facility.deployment_phase === 'live' ? 'bg-green-500/10 text-green-400' :
                    facility.deployment_phase === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {facility.deployment_phase?.replace('_', ' ') || 'Not Started'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Organization Details</h3>
          <div className="space-y-4">
            {organization.primary_contact_name && (
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Primary Contact</p>
                  <p className="text-white">{organization.primary_contact_name}</p>
                </div>
              </div>
            )}
            {organization.primary_contact_email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <a href={`mailto:${organization.primary_contact_email}`} className="text-teal-400 hover:text-teal-300">
                    {organization.primary_contact_email}
                  </a>
                </div>
              </div>
            )}
            {organization.contact_phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <a href={`tel:${organization.contact_phone}`} className="text-teal-400 hover:text-teal-300">
                    {organization.contact_phone}
                  </a>
                </div>
              </div>
            )}
            {(organization.address || organization.city) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <p className="text-xs text-slate-400">Address</p>
                  <p className="text-white">
                    {organization.address && <span>{organization.address}<br /></span>}
                    {organization.city}, {organization.state} {organization.zip}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Contract Info</h3>
          <div className="space-y-4">
            {organization.contract_number && (
              <div>
                <p className="text-xs text-slate-400">Contract Number</p>
                <p className="text-white font-medium">{organization.contract_number}</p>
              </div>
            )}
            {organization.contract_start_date && (
              <div>
                <p className="text-xs text-slate-400">Start Date</p>
                <p className="text-white">{format(new Date(organization.contract_start_date), 'MMM d, yyyy')}</p>
              </div>
            )}
            {organization.contract_end_date && (
              <div>
                <p className="text-xs text-slate-400">End Date</p>
                <p className="text-white">{format(new Date(organization.contract_end_date), 'MMM d, yyyy')}</p>
              </div>
            )}
            {isProximityAdmin && (
              <div>
                <p className="text-xs text-slate-400">Annual Contract Value</p>
                <p className="text-white font-semibold">{formatCurrency(organization.annual_contract_value)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsTab({ organization, projects, facilities, onRefresh }) {
  const [expandedProject, setExpandedProject] = useState(null);

  const getProjectFacilities = (projectId) => {
    return facilities.filter(f => f.project_id === projectId);
  };

  const getStatusColor = (phase) => {
    const colors = {
      live: 'bg-green-500',
      in_progress: 'bg-blue-500',
      blocked: 'bg-red-500',
      not_started: 'bg-slate-500'
    };
    return colors[phase] || colors.not_started;
  };

  const getStatusBadge = (status) => {
    const badges = {
      planning: 'bg-slate-600',
      in_progress: 'bg-blue-600',
      on_hold: 'bg-amber-600',
      completed: 'bg-green-600'
    };
    return badges[status] || badges.planning;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Projects ({projects.length})
        </h3>
        <Link
          to="/projects"
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Folder className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No projects created yet</p>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => {
            const projectFacilities = getProjectFacilities(project.id);
            const isExpanded = expandedProject === project.id;

            return (
              <div key={project.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Folder className="w-5 h-5 text-teal-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/projects/${project.id}`}
                            className="text-white font-medium hover:text-teal-400 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {project.name}
                          </Link>
                          <span className={`px-2 py-0.5 ${getStatusBadge(project.status)} text-white rounded text-xs font-medium`}>
                            {project.status?.replace('_', ' ')}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-slate-400 text-sm mt-1">{project.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-slate-400">{projectFacilities.length} facilit{projectFacilities.length !== 1 ? 'ies' : 'y'}</p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-700">
                    {projectFacilities.length === 0 ? (
                      <div className="p-8 text-center">
                        <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm mb-3">No facilities in this project</p>
                        <Link
                          to="/facilities"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Facility
                        </Link>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-900/30">
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Facility</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Phase</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Go-Live</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {projectFacilities.map(facility => (
                            <tr key={facility.id} className="hover:bg-slate-700/30 transition-colors">
                              <td className="px-6 py-4">
                                <Link to={`/facilities/${facility.id}`} className="text-white font-medium hover:text-teal-400 transition-colors">
                                  {facility.name}
                                </Link>
                              </td>
                              <td className="px-6 py-4 text-slate-400">
                                {facility.city}, {facility.state}
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-slate-300 text-sm">
                                  {facility.phase || 'Not Set'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-400">
                                {facility.projected_go_live
                                  ? format(new Date(facility.projected_go_live), 'MMM d, yyyy')
                                  : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Link
                                  to={`/facilities/${facility.id}`}
                                  className="text-teal-400 hover:text-teal-300 text-sm"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BillingTab({ organization }) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Billing Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">Billing Frequency</p>
            <p className="text-white capitalize">{organization.billing_frequency || 'Monthly'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Payment Terms</p>
            <p className="text-white">Net 30</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Last Invoice Date</p>
            <p className="text-white">
              {organization.last_invoice_date
                ? format(new Date(organization.last_invoice_date), 'MMMM d, yyyy')
                : 'No invoices yet'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Next Invoice Date</p>
            <p className="text-white">
              {organization.next_invoice_date
                ? format(new Date(organization.next_invoice_date), 'MMMM d, yyyy')
                : 'Not scheduled'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Invoices</h3>
        </div>
        <div className="text-center py-8">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Invoice history coming soon</p>
        </div>
      </div>
    </div>
  );
}

function ContactsTab({ organization }) {
  const contacts = [];

  if (organization.primary_contact_name) {
    contacts.push({
      name: organization.primary_contact_name,
      email: organization.primary_contact_email,
      phone: organization.contact_phone,
      role: 'Primary Contact'
    });
  }

  if (organization.secondary_contact_name) {
    contacts.push({
      name: organization.secondary_contact_name,
      email: organization.secondary_contact_email,
      role: 'Secondary Contact'
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Contacts</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm">
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No contacts added yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact, idx) => (
            <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center">
                    <span className="text-teal-400 font-bold">
                      {contact.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium">{contact.name}</p>
                    <p className="text-slate-400 text-sm">{contact.role}</p>
                  </div>
                </div>
                <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="space-y-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <a href={`mailto:${contact.email}`} className="text-teal-400 hover:text-teal-300">
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <a href={`tel:${contact.phone}`} className="text-teal-400 hover:text-teal-300">
                      {contact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ organization }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Documents</h3>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm">
          <Plus className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No documents uploaded yet</p>
        <p className="text-slate-500 text-sm mt-2">Upload contracts, agreements, and other important documents</p>
      </div>
    </div>
  );
}

function ActivityTab({ organization }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Activity Log</h3>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-teal-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-white text-sm">Organization created</p>
              <p className="text-slate-400 text-xs mt-1">
                {organization.created_at
                  ? format(new Date(organization.created_at), 'MMMM d, yyyy h:mm a')
                  : 'Unknown'}
              </p>
            </div>
          </div>
          {organization.updated_at && organization.updated_at !== organization.created_at && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Pencil className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-white text-sm">Organization updated</p>
                <p className="text-slate-400 text-xs mt-1">
                  {format(new Date(organization.updated_at), 'MMMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersTab({ organization }) {
  const { isInternalUser } = useOrganization();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');

  useEffect(() => {
    loadUsers();
  }, [organization.id]);

  async function loadUsers() {
    try {
      setLoading(true);
      const assignedUsers = await organizationAssignmentsService.getUsersForOrganization(organization.id);
      setUsers(assignedUsers);

      if (isInternalUser) {
        const { data: allUserRoles } = await supabase
          .from('user_roles')
          .select('*')
          .order('display_name');
        setAllUsers(allUserRoles || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!selectedUserId) return;

    try {
      await organizationAssignmentsService.assignUserToOrganization(
        selectedUserId,
        organization.id,
        selectedRole,
        false
      );
      setShowAddModal(false);
      setSelectedUserId('');
      setSelectedRole('viewer');
      loadUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user');
    }
  }

  async function handleRemoveUser(userId) {
    if (!confirm('Remove this user from the organization?')) return;

    try {
      await organizationAssignmentsService.removeAssignment(userId, organization.id);
      loadUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Failed to remove user');
    }
  }

  const getRoleBadge = (role) => {
    const badges = {
      customer_admin: 'bg-green-500/20 text-green-400',
      customer_user: 'bg-blue-500/20 text-blue-400',
      viewer: 'bg-slate-500/20 text-slate-400'
    };
    return badges[role] || badges.viewer;
  };

  const getRoleLabel = (role) => {
    const labels = {
      customer_admin: 'Admin',
      customer_user: 'User',
      viewer: 'Viewer'
    };
    return labels[role] || 'Viewer';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const availableUsers = allUsers.filter(
    u => !users.find(assigned => assigned.user_id === u.user_id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Users ({users.length})
        </h3>
        {isInternalUser && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No users assigned to this organization</p>
          {isInternalUser && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add First User
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Access Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Assigned</th>
                {isInternalUser && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{user.display_name}</p>
                      <p className="text-slate-400 text-sm">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-300 text-sm">{user.role}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadge(user.org_role)}`}>
                      {getRoleLabel(user.org_role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {user.assigned_at ? format(new Date(user.assigned_at), 'MMM d, yyyy') : '-'}
                  </td>
                  {isInternalUser && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveUser(user.user_id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                        title="Remove user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowAddModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
              <div className="px-6 py-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Add User to Organization</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Select User</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Choose a user...</option>
                    {availableUsers.map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.display_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Access Level</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="customer_admin">Admin - Full access</option>
                    <option value="customer_user">User - Can edit</option>
                    <option value="viewer">Viewer - Read only</option>
                  </select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={!selectedUserId}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
                >
                  Add User
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
