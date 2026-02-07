import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsService } from '../services/projectsService';
import { organizationsService } from '../services/organizationsService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Building2, Folder, Calendar, User, AlertCircle, Clock,
  CheckCircle2, Plus, Pencil, MapPin, TrendingUp, Activity,
  Eye, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown,
  Layers, X, Check, Loader2, ArrowRightLeft
} from 'lucide-react';
import { facilityStatsService } from '../services/facilityStatsService';
import { templatesService } from '../services/templatesService';
import { auditService } from '../services/auditService';
import { format, formatDistanceToNow } from 'date-fns';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isEditor } = useAuth();
  const [project, setProject] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadProject();
  }, [id]);

  async function loadProject() {
    try {
      const projectData = await projectsService.getById(id);
      setProject(projectData);

      if (projectData.organization_id) {
        const orgData = await organizationsService.getById(projectData.organization_id);
        setOrganization(orgData);
      }

      const { data: facilitiesData } = await supabase
        .from('facilities')
        .select('*, milestones(id, status, category)')
        .eq('project_id', id)
        .order('name');

      setFacilities(facilitiesData || []);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Project not found</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 text-teal-400 hover:text-teal-300"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Folder },
    { id: 'activity', label: 'Activity', icon: Activity }
  ];

  const getStatusBadge = (status) => {
    const badges = {
      planning: { label: 'Planning', color: 'bg-slate-600 text-white' },
      in_progress: { label: 'In Progress', color: 'bg-blue-600 text-white' },
      on_hold: { label: 'On Hold', color: 'bg-amber-600 text-white' },
      completed: { label: 'Completed', color: 'bg-green-600 text-white' },
      cancelled: { label: 'Cancelled', color: 'bg-red-600 text-white' }
    };
    return badges[status] || badges.planning;
  };

  const statusBadge = getStatusBadge(project.status);

  const liveFacilities = facilities.filter(f => f.deployment_phase === 'live').length;
  const inProgressFacilities = facilities.filter(f => f.deployment_phase === 'in_progress').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 bg-teal-600 rounded-xl flex items-center justify-center text-white">
            <Folder className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <span className={`px-3 py-1 ${statusBadge.color} rounded-full text-xs font-semibold`}>
                {statusBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {organization && (
                <Link
                  to={`/organizations/${organization.id}`}
                  className="text-slate-400 text-sm hover:text-teal-400 transition-colors"
                >
                  {organization.name}
                </Link>
              )}
              <span className="text-slate-400 text-sm">
                {facilities.length} facilit{facilities.length !== 1 ? 'ies' : 'y'}
              </span>
            </div>
          </div>
        </div>
        {isEditor && (
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit Project
          </button>
        )}
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
          <OverviewTab project={project} organization={organization} facilities={facilities} isEditor={isEditor} onRefresh={loadProject} />
        )}
        {activeTab === 'activity' && (
          <ActivityTab project={project} facilities={facilities} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ project, organization, facilities, isEditor, onRefresh }) {
  const navigate = useNavigate();
  const [removingId, setRemovingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignFacilityId, setReassignFacilityId] = useState(null);

  const facilitiesWithStats = facilities.map(f => {
    const status = facilityStatsService.calculateOverallStatus(f);
    const milestoneProgress = facilityStatsService.calculateCompletionPercentage(f.milestones);
    const completedMilestones = f.milestones?.filter(m => m.status === 'complete').length || 0;
    const totalMilestones = f.milestones?.length || 0;
    return { ...f, calculatedStatus: status, milestoneProgress, completedMilestones, totalMilestones };
  });

  const liveFacilities = facilitiesWithStats.filter(f => f.calculatedStatus === 'live').length;
  const inProgressFacilities = facilitiesWithStats.filter(f => f.calculatedStatus === 'in_progress').length;
  const blockedFacilities = facilitiesWithStats.filter(f => f.calculatedStatus === 'blocked').length;
  const notStartedFacilities = facilitiesWithStats.filter(f => f.calculatedStatus === 'not_started').length;

  const filteredAndSorted = React.useMemo(() => {
    let result = [...facilitiesWithStats];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(f =>
        f.name?.toLowerCase().includes(term) ||
        f.city?.toLowerCase().includes(term) ||
        f.state?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(f => f.calculatedStatus === statusFilter);
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'name':
            aVal = a.name?.toLowerCase() || '';
            bVal = b.name?.toLowerCase() || '';
            break;
          case 'location':
            aVal = `${a.city} ${a.state}`.toLowerCase();
            bVal = `${b.city} ${b.state}`.toLowerCase();
            break;
          case 'status':
            aVal = a.calculatedStatus;
            bVal = b.calculatedStatus;
            break;
          case 'milestones':
            aVal = a.milestoneProgress;
            bVal = b.milestoneProgress;
            break;
          case 'go_live':
            aVal = a.projected_go_live_date ? new Date(a.projected_go_live_date).getTime() : 0;
            bVal = b.projected_go_live_date ? new Date(b.projected_go_live_date).getTime() : 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [facilitiesWithStats, searchTerm, statusFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />;
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map(f => f.id)));
    }
  };

  const handleTemplateApplied = () => {
    setShowTemplateModal(false);
    setSelectedIds(new Set());
    onRefresh();
  };

  async function handleRemoveFacility(facilityId) {
    if (!confirm('Remove this facility from the project? The facility will not be deleted, only unlinked from this project.')) return;
    setRemovingId(facilityId);
    try {
      await supabase
        .from('facilities')
        .update({ project_id: null })
        .eq('id', facilityId);
      onRefresh();
    } catch (err) {
      console.error('Error removing facility:', err);
    } finally {
      setRemovingId(null);
      setActionMenuId(null);
    }
  }

  const getProgressBarColor = (progress) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 50) return 'bg-teal-500';
    if (progress > 0) return 'bg-blue-500';
    return 'bg-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                <span className="text-xs text-slate-400">Total</span>
              </div>
              <p className="text-2xl font-bold text-white">{facilities.length}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400">Live</span>
              </div>
              <p className="text-2xl font-bold text-white">{liveFacilities}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">In Progress</span>
              </div>
              <p className="text-2xl font-bold text-white">{inProgressFacilities}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-slate-400">Blocked</span>
              </div>
              <p className="text-2xl font-bold text-white">{blockedFacilities}</p>
            </div>
          </div>

          {project.description && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <p className="text-slate-300 leading-relaxed">{project.description}</p>
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Facilities Live</span>
                  <span className="text-sm font-medium text-white">
                    {facilities.length > 0 ? Math.round((liveFacilities / facilities.length) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-teal-500"
                    style={{ width: `${facilities.length > 0 ? (liveFacilities / facilities.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-green-400">{liveFacilities}</p>
                  <p className="text-xs text-slate-400">Live</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-400">{inProgressFacilities}</p>
                  <p className="text-xs text-slate-400">In Progress</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-red-400">{blockedFacilities}</p>
                  <p className="text-xs text-slate-400">Blocked</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-400">{notStartedFacilities}</p>
                  <p className="text-xs text-slate-400">Not Started</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Details</h3>
            <div className="space-y-4">
              {organization && (
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <p className="text-xs text-slate-400">Organization</p>
                    <Link
                      to={`/organizations/${organization.id}`}
                      className="text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      {organization.name}
                    </Link>
                  </div>
                </div>
              )}
              {project.project_manager && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <p className="text-xs text-slate-400">Project Manager</p>
                    <p className="text-white">{project.project_manager}</p>
                  </div>
                </div>
              )}
              {project.start_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <p className="text-xs text-slate-400">Start Date</p>
                    <p className="text-white">{format(new Date(project.start_date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              )}
              {project.target_completion_date && (
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <p className="text-xs text-slate-400">Target Completion</p>
                    <p className="text-white">{format(new Date(project.target_completion_date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && isEditor && (
        <div className="sticky top-0 z-10 bg-teal-900/90 border border-teal-700 rounded-xl px-5 py-3 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {selectedIds.size}
            </div>
            <span className="text-teal-100 text-sm font-medium">
              {selectedIds.size === 1 ? '1 facility' : `${selectedIds.size} facilities`} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReassignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium text-sm"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Reassign
            </button>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
            >
              <Layers className="w-4 h-4" />
              Apply Template
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-2 text-teal-300 hover:text-white hover:bg-teal-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            Facilities ({facilities.length})
          </h3>
          {isEditor && (
            <Link
              to="/facilities"
              className="flex items-center gap-2 px-3 py-1.5 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Facility
            </Link>
          )}
        </div>

        {facilities.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-700 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="live">Live</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="not_started">Not Started</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        {facilities.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-4">No facilities in this project yet</p>
            {isEditor && (
              <Link
                to="/facilities"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Add First Facility
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/30">
                  {isEditor && (
                    <th className="pl-6 pr-2 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={filteredAndSorted.length > 0 && selectedIds.size === filteredAndSorted.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </th>
                  )}
                  {[
                    { key: 'name', label: 'Facility' },
                    { key: 'location', label: 'Location' },
                    { key: 'status', label: 'Status' },
                    { key: 'milestones', label: 'Milestones' },
                    { key: 'go_live', label: 'Go-Live' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {col.label}
                        {getSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={isEditor ? 7 : 6} className="px-6 py-12 text-center text-slate-400">
                      {searchTerm || statusFilter !== 'all'
                        ? 'No facilities match your filters'
                        : 'No facilities found'}
                    </td>
                  </tr>
                ) : filteredAndSorted.map(facility => {
                  const statusBadgeColor = facilityStatsService.getStatusBadgeColor(facility.calculatedStatus);
                  const statusLabel = facility.calculatedStatus.replace('_', ' ');
                  const isSelected = selectedIds.has(facility.id);

                  return (
                    <tr
                      key={facility.id}
                      className={`hover:bg-slate-700/30 transition-colors group ${isSelected ? 'bg-teal-900/20' : ''}`}
                    >
                      {isEditor && (
                        <td className="pl-6 pr-2 py-4 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(facility.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <Link to={`/facilities/${facility.id}`} className="text-white font-medium hover:text-teal-400 transition-colors">
                          {facility.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {[facility.city, facility.state].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold capitalize ${statusBadgeColor} ${facilityStatsService.getStatusTextColor(facility.calculatedStatus)}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {facility.totalMilestones > 0 ? (
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${getProgressBarColor(facility.milestoneProgress)}`}
                                style={{ width: `${facility.milestoneProgress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                              {facility.completedMilestones}/{facility.totalMilestones}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">No milestones</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {facility.projected_go_live_date
                          ? format(new Date(facility.projected_go_live_date), 'MMM d, yyyy')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/facilities/${facility.id}`}
                            className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {isEditor && (
                            <>
                              <Link
                                to={`/facilities/${facility.id}`}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => setReassignFacilityId(facility.id)}
                                className="p-1.5 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded transition-colors"
                                title="Reassign to another project"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveFacility(facility.id)}
                                disabled={removingId === facility.id}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                                title="Remove from project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTemplateModal && (
        <ApplyTemplateModal
          selectedFacilityIds={[...selectedIds]}
          facilities={facilitiesWithStats}
          onClose={() => setShowTemplateModal(false)}
          onApplied={handleTemplateApplied}
        />
      )}

      {(showReassignModal || reassignFacilityId) && (
        <ReassignFacilitiesModal
          facilityIds={reassignFacilityId ? [reassignFacilityId] : [...selectedIds]}
          facilities={facilitiesWithStats}
          currentProjectId={project.id}
          currentProjectName={project.name}
          onClose={() => {
            setShowReassignModal(false);
            setReassignFacilityId(null);
          }}
          onReassigned={() => {
            setShowReassignModal(false);
            setReassignFacilityId(null);
            setSelectedIds(new Set());
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function ApplyTemplateModal({ selectedFacilityIds, facilities, onClose, onApplied }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await templatesService.getDeploymentTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!selectedTemplateId) return;
    setApplying(true);
    setError('');
    setProgress({ done: 0, total: selectedFacilityIds.length });

    const succeeded = [];
    const failed = [];

    for (const facilityId of selectedFacilityIds) {
      try {
        await templatesService.applyTemplateToFacility(facilityId, selectedTemplateId);
        succeeded.push(facilityId);
      } catch (err) {
        failed.push({ id: facilityId, error: err.message });
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setApplying(false);
    setResults({ succeeded, failed });

    if (failed.length === 0) {
      setTimeout(() => onApplied(), 1200);
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const selectedFacilities = facilities.filter(f => selectedFacilityIds.includes(f.id));
  const facilitiesWithTemplate = selectedFacilities.filter(f => f.deployment_template_id);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Apply Deployment Template</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Apply to {selectedFacilityIds.length} selected facilit{selectedFacilityIds.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {results ? (
            <div className="space-y-4">
              {results.succeeded.length > 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                    <Check className="w-4 h-4" />
                    {results.succeeded.length} facilit{results.succeeded.length === 1 ? 'y' : 'ies'} updated
                  </div>
                  <p className="text-green-300/70 text-sm">Template milestones and equipment have been created.</p>
                </div>
              )}
              {results.failed.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {results.failed.length} failed
                  </div>
                  <ul className="space-y-1 text-sm text-red-300/70">
                    {results.failed.map(f => {
                      const fac = facilities.find(fac => fac.id === f.id);
                      return (
                        <li key={f.id}>{fac?.name || 'Unknown'}: {f.error}</li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {results.failed.length > 0 && (
                <button
                  onClick={onApplied}
                  className="w-full py-2.5 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
                >
                  Done
                </button>
              )}
            </div>
          ) : (
            <>
              {facilitiesWithTemplate.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-amber-400 text-sm">
                    {facilitiesWithTemplate.length} of the selected facilit{facilitiesWithTemplate.length === 1 ? 'y already has' : 'ies already have'} a template.
                    Applying a new template will add additional milestones and equipment.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Template
                </label>
                {loading ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-slate-400 text-sm py-3">
                    No deployment templates available. Create one in Settings first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <label
                        key={t.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplateId === t.id
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="template"
                          value={t.id}
                          checked={selectedTemplateId === t.id}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="mt-0.5 w-4 h-4 text-teal-500 border-slate-600 bg-slate-900 focus:ring-teal-500 focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{t.template_name}</span>
                            {t.is_system_template && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-slate-700 text-slate-300 rounded">System</span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-slate-400 text-xs mt-0.5 truncate">{t.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span>{t.template_milestones?.length || 0} milestones</span>
                            <span>{t.template_equipment?.length || 0} equipment</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-sm">
                  <p className="text-slate-300 font-medium mb-2">Will create for each facility:</p>
                  <ul className="space-y-1 text-slate-400">
                    {selectedTemplate.template_milestones?.length > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400" />
                        {selectedTemplate.template_milestones.length} milestone{selectedTemplate.template_milestones.length !== 1 ? 's' : ''}
                      </li>
                    )}
                    {selectedTemplate.template_equipment?.length > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-teal-400" />
                        {selectedTemplate.template_equipment.length} equipment item{selectedTemplate.template_equipment.length !== 1 ? 's' : ''}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 mb-2">Selected facilities:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFacilities.map(f => (
                    <span key={f.id} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!results && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedTemplateId || applying || templates.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying ({progress.done}/{progress.total})...
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  Apply to {selectedFacilityIds.length} Facilit{selectedFacilityIds.length === 1 ? 'y' : 'ies'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReassignFacilitiesModal({ facilityIds, facilities, currentProjectId, currentProjectName, onClose, onReassigned }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);

  const selectedFacilities = facilities.filter(f => facilityIds.includes(f.id));

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await projectsService.getAll();
      setProjects((data || []).filter(p => p.id !== currentProjectId));
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleReassign() {
    if (!selectedProjectId) return;
    setReassigning(true);
    setError('');
    setProgress({ done: 0, total: facilityIds.length });

    const succeeded = [];
    const failed = [];

    for (const facilityId of facilityIds) {
      try {
        const newProjectId = selectedProjectId === '__none__' ? null : selectedProjectId;
        await supabase
          .from('facilities')
          .update({ project_id: newProjectId })
          .eq('id', facilityId);
        succeeded.push(facilityId);
      } catch (err) {
        failed.push({ id: facilityId, error: err.message });
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setReassigning(false);
    setResults({ succeeded, failed });

    if (failed.length === 0) {
      setTimeout(() => onReassigned(), 1200);
    }
  }

  const filteredProjects = projects.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.organization?.name?.toLowerCase().includes(term);
  });

  const targetProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Reassign Facilities</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Move {facilityIds.length} facilit{facilityIds.length === 1 ? 'y' : 'ies'} from {currentProjectName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={reassigning}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {results ? (
            <div className="space-y-4">
              {results.succeeded.length > 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                    <Check className="w-4 h-4" />
                    {results.succeeded.length} facilit{results.succeeded.length === 1 ? 'y' : 'ies'} reassigned
                  </div>
                  <p className="text-green-300/70 text-sm">
                    {selectedProjectId === '__none__'
                      ? 'Facilities have been unassigned from any project.'
                      : `Facilities have been moved to ${targetProject?.name || 'the selected project'}.`}
                  </p>
                </div>
              )}
              {results.failed.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {results.failed.length} failed
                  </div>
                  <ul className="space-y-1 text-sm text-red-300/70">
                    {results.failed.map(f => {
                      const fac = facilities.find(fac => fac.id === f.id);
                      return <li key={f.id}>{fac?.name || 'Unknown'}: {f.error}</li>;
                    })}
                  </ul>
                </div>
              )}
              {results.failed.length > 0 && (
                <button
                  onClick={onReassigned}
                  className="w-full py-2.5 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
                >
                  Done
                </button>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs text-slate-400 mb-2">Facilities to reassign:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFacilities.map(f => (
                    <span key={f.id} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select destination project
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    <button
                      onClick={() => setSelectedProjectId('__none__')}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedProjectId === '__none__'
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                      }`}
                    >
                      <p className={`font-medium text-sm ${selectedProjectId === '__none__' ? 'text-amber-400' : 'text-slate-300'}`}>
                        No Project (Unassigned)
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Remove from current project without assigning to another</p>
                    </button>

                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedProjectId === p.id
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Folder className={`w-4 h-4 ${selectedProjectId === p.id ? 'text-teal-400' : 'text-slate-400'}`} />
                          <span className={`font-medium text-sm ${selectedProjectId === p.id ? 'text-teal-400' : 'text-white'}`}>
                            {p.name}
                          </span>
                        </div>
                        {p.organization?.name && (
                          <p className="text-xs text-slate-500 mt-1 pl-6">{p.organization.name}</p>
                        )}
                      </button>
                    ))}

                    {filteredProjects.length === 0 && searchTerm && (
                      <p className="text-center text-slate-400 text-sm py-4">No projects match your search</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!results && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={onClose}
              disabled={reassigning}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReassign}
              disabled={!selectedProjectId || reassigning}
              className="flex items-center gap-2 px-5 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reassigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reassigning ({progress.done}/{progress.total})...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Reassign {facilityIds.length} Facilit{facilityIds.length === 1 ? 'y' : 'ies'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTab({ project, facilities }) {
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filterTable, setFilterTable] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const ITEMS_PER_PAGE = 30;

  const facilityIds = facilities.map(f => f.id);
  const facilityMap = Object.fromEntries(facilities.map(f => [f.id, f]));

  useEffect(() => {
    if (facilityIds.length > 0) loadActivity();
    else setLoading(false);
  }, [facilityIds.length, page]);

  async function loadActivity() {
    try {
      setLoading(true);
      const [log, count] = await Promise.all([
        auditService.getProjectActivityLog(facilityIds, ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
        auditService.getProjectActivityLogCount(facilityIds),
      ]);
      setActivityLog(log);
      setTotalCount(count);
    } catch (err) {
      console.error('Error loading project activity:', err);
    } finally {
      setLoading(false);
    }
  }

  const formatTableName = (name) => {
    if (!name) return 'Unknown';
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatFieldName = (name) => {
    if (!name) return '';
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getActionStyle = (action) => {
    switch (action) {
      case 'created': return { dot: 'bg-green-400', badge: 'bg-green-500/15 text-green-400' };
      case 'updated': return { dot: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-400' };
      case 'deleted': return { dot: 'bg-red-400', badge: 'bg-red-500/15 text-red-400' };
      default: return { dot: 'bg-slate-400', badge: 'bg-slate-500/15 text-slate-400' };
    }
  };

  const filtered = activityLog.filter(entry => {
    if (filterTable && entry.table_name !== filterTable) return false;
    if (filterAction && entry.action !== filterAction) return false;
    return true;
  });

  const uniqueTables = [...new Set(activityLog.map(e => e.table_name).filter(Boolean))];
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          Project Activity
          {totalCount > 0 && (
            <span className="text-sm font-normal text-slate-400">({totalCount} events)</span>
          )}
        </h3>
      </div>

      {facilityIds.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Table</label>
              <select
                value={filterTable}
                onChange={(e) => { setFilterTable(e.target.value); setPage(0); }}
                className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="">All Tables</option>
                {uniqueTables.map(t => (
                  <option key={t} value={t}>{formatTableName(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
                className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-700 text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Loading activity...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">
            {facilityIds.length === 0
              ? 'No facilities in this project yet'
              : filterTable || filterAction
                ? 'No matching activity found'
                : 'No activity recorded yet. Changes to facilities, milestones, equipment, and more will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700/50">
          {filtered.map(entry => {
            const style = getActionStyle(entry.action);
            const facility = facilityMap[entry.facility_id];
            return (
              <div key={entry.id} className="px-5 py-4 hover:bg-slate-700/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${style.badge}`}>
                        {entry.action}
                      </span>
                      <span className="text-slate-300 text-sm font-medium">
                        {formatTableName(entry.table_name)}
                      </span>
                      {entry.field_name && (
                        <>
                          <span className="text-slate-600 text-xs">/</span>
                          <span className="text-slate-400 text-sm">
                            {formatFieldName(entry.field_name)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      {facility && (
                        <Link
                          to={`/facilities/${facility.id}`}
                          className="text-teal-400 hover:text-teal-300 transition-colors font-medium"
                        >
                          {facility.name}
                        </Link>
                      )}
                      {facility && <span className="text-slate-600">--</span>}
                      <span className="text-slate-400">{entry.user}</span>
                      <span className="text-slate-600">--</span>
                      <span title={new Date(entry.timestamp).toLocaleString()}>
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    {entry.action === 'updated' && (entry.old_value || entry.new_value) && (
                      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {entry.old_value && (
                          <div className="px-3 py-1.5 bg-slate-900/60 border border-slate-700/50 rounded text-xs text-slate-400 truncate">
                            <span className="text-slate-500 mr-1">was:</span> {entry.old_value}
                          </div>
                        )}
                        {entry.new_value && (
                          <div className="px-3 py-1.5 bg-teal-500/5 border border-teal-500/20 rounded text-xs text-teal-300 truncate">
                            <span className="text-teal-500/70 mr-1">now:</span> {entry.new_value}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            Previous
          </button>
          <span className="text-slate-400 text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
