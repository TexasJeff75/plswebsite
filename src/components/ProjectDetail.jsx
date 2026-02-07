import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsService } from '../services/projectsService';
import { organizationsService } from '../services/organizationsService';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Building2, Folder, Calendar, User, AlertCircle, Clock,
  CheckCircle2, Plus, Pencil, MapPin, TrendingUp, Activity,
  Eye, Trash2, MoreHorizontal, ChevronRight
} from 'lucide-react';
import { facilityStatsService } from '../services/facilityStatsService';
import { format } from 'date-fns';

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
          <ActivityTab project={project} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ project, organization, facilities, isEditor, onRefresh }) {
  const navigate = useNavigate();
  const [removingId, setRemovingId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Facility</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Milestones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Go-Live</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {facilitiesWithStats.map(facility => {
                  const statusBadgeColor = facilityStatsService.getStatusBadgeColor(facility.calculatedStatus);
                  const statusLabel = facility.calculatedStatus.replace('_', ' ');

                  return (
                    <tr key={facility.id} className="hover:bg-slate-700/30 transition-colors group">
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
    </div>
  );
}

function ActivityTab({ project }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Activity Log</h3>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-teal-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Folder className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="text-white text-sm">Project created</p>
              <p className="text-slate-400 text-xs mt-1">
                {project.created_at
                  ? format(new Date(project.created_at), 'MMMM d, yyyy h:mm a')
                  : 'Unknown'}
              </p>
            </div>
          </div>
          {project.updated_at && project.updated_at !== project.created_at && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Pencil className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-white text-sm">Project updated</p>
                <p className="text-slate-400 text-xs mt-1">
                  {format(new Date(project.updated_at), 'MMMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
